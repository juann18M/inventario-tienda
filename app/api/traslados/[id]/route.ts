import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ======================== GET - OBTENER UN TRASLADO ========================
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const connection = await db.getConnection();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const userRole = user.role?.toLowerCase();
    const trasladoId = params.id;

    let userSucursalId: number | null = null;

    // 🔐 Obtener sucursal del usuario si no es admin
    if (userRole !== "admin") {
      const [sucursalRows]: any = await connection.execute(
        `SELECT id FROM sucursales WHERE nombre = ?`,
        [user.sucursal]
      );

      if (!sucursalRows.length) {
        return NextResponse.json(
          { error: "Sucursal del usuario no encontrada" },
          { status: 400 }
        );
      }

      userSucursalId = sucursalRows[0].id;
    }

    // 🔹 Obtener traslado con nombres de sucursal
    const [trasladoRows]: any = await connection.execute(
      `SELECT 
         t.id,
         t.fecha,
         t.estado,
         t.observacion,
         t.sucursal_origen AS sucursal_origen_id,
t.sucursal_destino AS sucursal_destino_id,
so.nombre AS sucursal_origen,
sd.nombre AS sucursal_destino,

         u.id as usuario_id,
         u.nombre as usuario_nombre,
         u.rol as usuario_rol,
         COALESCE((SELECT COUNT(*) FROM traslado_detalles WHERE traslado_id = t.id),0) as total_productos,
         COALESCE((SELECT SUM(cantidad) FROM traslado_detalles WHERE traslado_id = t.id),0) as total_cantidad
       FROM traslados t
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       LEFT JOIN sucursales so ON so.id = t.sucursal_origen
       LEFT JOIN sucursales sd ON sd.id = t.sucursal_destino
       WHERE t.id = ?`,
      [trasladoId]
    );

    if (!trasladoRows.length) {
      return NextResponse.json(
        { error: "Traslado no encontrado" },
        { status: 404 }
      );
    }

    const traslado = trasladoRows[0];

    // 🔐 Validar permisos
    if (userRole !== "admin") {
      if (
        traslado.sucursal_origen_id !== userSucursalId &&
        traslado.sucursal_destino_id !== userSucursalId
      ) {
        return NextResponse.json(
          { error: "No tienes permiso para ver este traslado" },
          { status: 403 }
        );
      }
    }

    // 🔹 Obtener detalles del traslado
    const [detallesRows]: any = await connection.execute(
      `SELECT 
         td.id,
         td.traslado_id,
         td.id_producto,
         td.cantidad,
         p.nombre as producto_nombre,
         p.sku as producto_sku,
         p.talla as producto_talla,
         p.color as producto_color,
         p.precio as producto_precio,
         p.imagen as producto_imagen
       FROM traslado_detalles td
       LEFT JOIN productos p ON p.id = td.id_producto
       WHERE td.traslado_id = ?`,
      [trasladoId]
    );

    const detalles = detallesRows || [];

    // 🔥 Devolver el objeto completo con detalles
    return NextResponse.json({
      success: true,
      traslado: {
        id: traslado.id,
        fecha: traslado.fecha,
        estado: traslado.estado,
        observacion: traslado.observacion,
        sucursal_origen: traslado.sucursal_origen,
        sucursal_destino: traslado.sucursal_destino,
        usuario_nombre: traslado.usuario_nombre,
        usuario_rol: traslado.usuario_rol,
        total_productos: Number(traslado.total_productos),
        total_cantidad: Number(traslado.total_cantidad),
        detalles: detalles.map(d => ({
          id: d.id,
          id_producto: d.id_producto,
          cantidad: Number(d.cantidad),
          producto_nombre: d.producto_nombre,
          producto_sku: d.producto_sku,
          producto_talla: d.producto_talla,
          producto_color: d.producto_color,
          producto_precio: Number(d.producto_precio || 0),
          producto_imagen: d.producto_imagen
        }))
      }
    });

  } catch (error) {
    console.error("❌ Error al obtener traslado:", error);
    return NextResponse.json(
      { error: "Error al obtener el traslado" },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}

// ======================== DELETE - CANCELAR TRASLADO ========================
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const userRole = user.role?.toLowerCase();
    const trasladoId = params.id;

    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden cancelar traslados" },
        { status: 403 }
      );
    }

    const [trasladoRows]: any = await connection.execute(
      `SELECT * FROM traslados WHERE id = ?`,
      [trasladoId]
    );

    if (!trasladoRows.length) {
      return NextResponse.json(
        { error: "Traslado no encontrado" },
        { status: 404 }
      );
    }

    const traslado = trasladoRows[0];

    if (traslado.estado === "cancelado") {
      return NextResponse.json(
        { error: "Este traslado ya está cancelado" },
        { status: 400 }
      );
    }

    const [detalles]: any = await connection.execute(
      `SELECT td.*, p.sku 
       FROM traslado_detalles td
       LEFT JOIN productos p ON p.id = td.id_producto
       WHERE td.traslado_id = ?`,
      [trasladoId]
    );

    for (const detalle of detalles) {
      // 🔹 Restar del destino usando SKU
      const [destinoRows]: any = await connection.execute(
        `SELECT id, stock FROM productos 
         WHERE sku = ? AND sucursal = ?`,
        [detalle.sku, traslado.sucursal_destino]
      );

      if (destinoRows.length) {
        const productoDestino = destinoRows[0];

        if (Number(productoDestino.stock) <= Number(detalle.cantidad)) {
          await connection.execute(
            `DELETE FROM productos WHERE id = ?`,
            [productoDestino.id]
          );
        } else {
          await connection.execute(
            `UPDATE productos 
             SET stock = stock - ? 
             WHERE id = ?`,
            [detalle.cantidad, productoDestino.id]
          );
        }
      }

      // 🔹 Devolver stock al origen
      await connection.execute(
        `UPDATE productos 
         SET stock = stock + ? 
         WHERE id = ?`,
        [detalle.cantidad, detalle.id_producto]
      );
    }

    await connection.execute(
      `UPDATE traslados 
       SET estado = 'cancelado' 
       WHERE id = ?`,
      [trasladoId]
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: "Traslado cancelado y stock revertido correctamente"
    });

  } catch (error) {
    await connection.rollback();
    console.error("❌ Error al cancelar traslado:", error);
    return NextResponse.json(
      { error: "Error al cancelar el traslado" },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}