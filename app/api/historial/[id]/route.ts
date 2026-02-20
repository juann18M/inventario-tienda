import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const ventaId = Number(params.id);
    if (isNaN(ventaId) || ventaId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const user: any = session.user;
    const rol = user.role.toLowerCase();

    /* =============================
       1. VENTA PRINCIPAL
    ============================== */
    let where = "v.id = ?";
    const paramsVenta: any[] = [ventaId];

    if (rol !== "admin") {
      where += " AND v.usuario_id = ? AND v.sucursal_id = ?";
      paramsVenta.push(user.id, user.sucursal_id);
    }

    const [ventaRows]: any = await db.execute(
      `
      SELECT
        v.id,
        v.fecha,
        v.total,
        v.metodo_pago,
        v.cliente,
        v.observaciones,
        u.nombre AS usuario_nombre,
        u.rol AS usuario_rol,
        s.nombre AS sucursal_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      LEFT JOIN sucursales s ON v.sucursal_id = s.id
      WHERE ${where}
      `,
      paramsVenta
    );

    if (ventaRows.length === 0) {
      return NextResponse.json(
        { error: "Venta no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    const venta = ventaRows[0];

    /* =============================
       2. PRODUCTOS DE LA VENTA
       🔹 Usando directamente productos
    ============================== */
    const [productosRows]: any = await db.execute(
      `
      SELECT
        dv.id,
        dv.variante_id,
        dv.cantidad,
        dv.precio AS precio_unitario,
        (dv.cantidad * dv.precio) AS subtotal,

        p.id AS producto_id,
        p.nombre AS producto_nombre,
        p.sku AS producto_sku,
        p.categoria AS producto_categoria,
        p.descripcion AS producto_descripcion,
        p.talla,
        p.color

      FROM detalle_venta dv
      INNER JOIN productos p ON dv.variante_id = p.id
      WHERE dv.venta_id = ?
      ORDER BY dv.id ASC
      `,
      [ventaId]
    );

    /* =============================
       3. RESPUESTA FINAL
    ============================== */
    return NextResponse.json({
      success: true,
      venta: {
        id: venta.id,
        fecha: venta.fecha,
        total: Number(venta.total),
        metodo_pago: venta.metodo_pago,
        cliente: venta.cliente || "",
        observaciones: venta.observaciones || "",
        usuario_nombre: venta.usuario_nombre,
        usuario_rol: venta.usuario_rol,
        sucursal_nombre: venta.sucursal_nombre,
        productos: productosRows.map((p: any) => ({
          id: p.id,
          variante_id: p.variante_id,
          producto_id: p.producto_id,
          producto_nombre: p.producto_nombre,
          producto_sku: p.producto_sku,
          producto_categoria: p.producto_categoria,
          descripcion: p.producto_descripcion,
          talla: p.talla || "Única",
          color: p.color || "Sin color",
          cantidad: Number(p.cantidad),
          precio_unitario: Number(p.precio_unitario),
          subtotal: Number(p.subtotal),
        })),
      },
    });

  } catch (error: any) {
    console.error("❌ Error detalle venta:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
        detalle: error.sqlMessage || error.message,
      },
      { status: 500 }
    );
  }
}
