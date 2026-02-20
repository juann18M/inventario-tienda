import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ======================== GET APARTADO ========================
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const connection = await db.getConnection();

  try {
    const [apartadosRows]: any = await connection.execute(
      `SELECT a.id, a.cliente, a.total_apartado, a.fecha, a.estado,
              a.sucursal_id, s.nombre as sucursal_nombre,
              a.observaciones, a.venta_id
       FROM apartados a
       LEFT JOIN sucursales s ON s.id = a.sucursal_id
       WHERE a.id = ?`,
      [params.id]
    );

    if (!apartadosRows.length) {
      return NextResponse.json({ error: "Apartado no encontrado" }, { status: 404 });
    }

    const apartadoRow = apartadosRows[0];

    const [productosRows]: any = await connection.execute(
      `SELECT da.producto_id, p.nombre,
              da.entrada as cantidad,
              da.precio_unitario as precio
       FROM detalle_apartado da
       JOIN productos p ON p.id = da.producto_id
       WHERE da.apartado_id = ?`,
      [apartadoRow.id]
    );

    const [abonosRows]: any = await connection.execute(
      `SELECT id, monto, fecha
       FROM abonos
       WHERE apartado_id = ?
       ORDER BY fecha DESC`,
      [apartadoRow.id]
    );

    const totalPagado = abonosRows.reduce(
      (sum: number, a: any) => sum + Number(a.monto),
      0
    );

    const total = Number(apartadoRow.total_apartado);
    const saldo = Number((total - totalPagado).toFixed(2));

    await connection.execute(
      `UPDATE apartados SET anticipo = ?, estado = ? WHERE id = ?`,
      [
        Number(totalPagado.toFixed(2)),
        totalPagado >= total ? "completado" : "pendiente",
        apartadoRow.id
      ]
    );

    return NextResponse.json({
      id: apartadoRow.id,
      cliente: apartadoRow.cliente,
      total: Number(total.toFixed(2)),
      anticipo: Number(totalPagado.toFixed(2)),
      saldo: saldo > 0 ? saldo : 0,
      fecha: apartadoRow.fecha,
      estado: totalPagado >= total ? "completado" : "pendiente",
      sucursal_id: apartadoRow.sucursal_id,
      sucursal_nombre: apartadoRow.sucursal_nombre,
      observaciones: apartadoRow.observaciones,
      venta_id: apartadoRow.venta_id,
      productos: productosRows.map((p: any) => ({
        producto_id: p.producto_id,
        nombre: p.nombre,
        cantidad: Number(p.cantidad),
        precio: Number(Number(p.precio).toFixed(2))
      })),
      abonos: abonosRows.map((a: any) => ({
        id: a.id,
        monto: Number(Number(a.monto).toFixed(2)),
        fecha: a.fecha
      }))
    });

  } catch (error) {
    console.error("Error al obtener apartado:", error);
    return NextResponse.json({ error: "Error al cargar apartado" }, { status: 500 });
  } finally {
    connection.release();
  }
}

// ======================== PATCH APARTADO ========================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const apartadoId = params.id;
    const body = await req.json();
    const montoAbono = Number(body.monto || 0);
    const liquidador = Boolean(body.liquidador);

    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const usuarioId = (session.user as any).id;

    const [apartadoRows]: any = await connection.execute(
      `SELECT total_apartado, estado, sucursal_id, cliente
       FROM apartados
       WHERE id = ?`,
      [apartadoId]
    );

    if (!apartadoRows.length)
      return NextResponse.json({ error: "Apartado no encontrado" }, { status: 404 });

    const apartado = apartadoRows[0];

    if (apartado.estado === "cancelado")
      return NextResponse.json({ error: "No se puede abonar a un apartado cancelado" }, { status: 400 });

    if (apartado.estado === "completado")
      return NextResponse.json({ error: "Este apartado ya está liquidado" }, { status: 400 });

    const total = Number(apartado.total_apartado);

    if (liquidador) {
      const [abonosActuales]: any = await connection.execute(
        `SELECT monto FROM abonos WHERE apartado_id = ?`,
        [apartadoId]
      );

      const pagadoActual = abonosActuales.reduce(
        (sum: number, a: any) => sum + Number(a.monto),
        0
      );

      const saldoPendiente = total - pagadoActual;

      if (saldoPendiente > 0) {
        await connection.execute(
          `INSERT INTO abonos (apartado_id, monto, fecha, usuario_id, sucursal_id)
           VALUES (?, ?, NOW(), ?, ?)`,
          [apartadoId, Number(saldoPendiente.toFixed(2)), usuarioId, apartado.sucursal_id]
        );
      }

    } else {
      await connection.execute(
        `INSERT INTO abonos (apartado_id, monto, fecha, usuario_id, sucursal_id)
         VALUES (?, ?, NOW(), ?, ?)`,
        [apartadoId, Number(montoAbono.toFixed(2)), usuarioId, apartado.sucursal_id]
      );
    }

    const [abonosRows]: any = await connection.execute(
      `SELECT monto FROM abonos WHERE apartado_id = ?`,
      [apartadoId]
    );

    const totalPagado = abonosRows.reduce(
      (sum: number, a: any) => sum + Number(a.monto),
      0
    );

    const nuevoEstado = totalPagado >= total ? "completado" : "pendiente";
    let ventaId = null;

    // Si se liquidó el apartado, crear una venta
    if (nuevoEstado === "completado" && apartado.estado !== "completado") {
      // Obtener productos del apartado
      const [productosRows]: any = await connection.execute(
        `SELECT producto_id, entrada as cantidad, precio_unitario as precio
         FROM detalle_apartado
         WHERE apartado_id = ?`,
        [apartadoId]
      );

      // Crear la venta
      const [ventaResult]: any = await connection.execute(
        `INSERT INTO ventas (sucursal_id, usuario_id, cliente, total, metodo_pago, fecha)
         VALUES (?, ?, ?, ?, 'APARTADO', NOW())`,
        [apartado.sucursal_id, usuarioId, apartado.cliente || "Cliente", total]
      );

      ventaId = ventaResult.insertId;

      // Insertar detalles de venta
      for (const producto of productosRows) {
        await connection.execute(
          `INSERT INTO detalle_venta (venta_id, variante_id, cantidad, precio)
           VALUES (?, ?, ?, ?)`,
          [ventaId, producto.producto_id, producto.cantidad, producto.precio]
        );
      }

      // Actualizar el apartado con el ID de la venta
      await connection.execute(
        `UPDATE apartados SET venta_id = ? WHERE id = ?`,
        [ventaId, apartadoId]
      );
    }

    await connection.execute(
      `UPDATE apartados SET anticipo = ?, estado = ? WHERE id = ?`,
      [Number(totalPagado.toFixed(2)), nuevoEstado, apartadoId]
    );

    await connection.commit();

    return NextResponse.json({
      message: "Abono registrado correctamente",
      pagado: Number(totalPagado.toFixed(2)),
      saldoPendiente: Number((total - totalPagado).toFixed(2)),
      estado: nuevoEstado,
      venta_id: ventaId,
      venta_creada: ventaId ? true : false
    });

  } catch (error) {
    await connection.rollback();
    console.error("Error al procesar abono:", error);
    return NextResponse.json({ error: "Error al procesar abono" }, { status: 500 });
  } finally {
    connection.release();
  }
}

// ======================== DELETE APARTADO ========================
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const apartadoId = params.id;
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const deleteLiquidado = url.searchParams.get("deleteLiquidado") === "true";

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    if ((force || deleteLiquidado) && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo administradores pueden realizar esta acción" },
        { status: 403 }
      );
    }

    const [apartadoRows]: any = await connection.execute(
      `SELECT a.*, s.nombre as sucursal_nombre 
       FROM apartados a
       LEFT JOIN sucursales s ON s.id = a.sucursal_id
       WHERE a.id = ?`,
      [apartadoId]
    );

    if (!apartadoRows.length) {
      return NextResponse.json({ error: "Apartado no encontrado" }, { status: 404 });
    }

    const apartado = apartadoRows[0];

    // ===== ELIMINAR APARTADO LIQUIDADO COMPLETAMENTE =====
    if (deleteLiquidado) {
      if (apartado.estado !== "completado") {
        return NextResponse.json(
          { error: "Solo se pueden eliminar apartados liquidados" },
          { status: 400 }
        );
      }

      if (apartado.venta_id) {
        await connection.execute(`DELETE FROM detalle_venta WHERE venta_id = ?`, [apartado.venta_id]);
        await connection.execute(`DELETE FROM ventas WHERE id = ?`, [apartado.venta_id]);
      }

      await connection.execute(`DELETE FROM detalle_apartado WHERE apartado_id = ?`, [apartadoId]);
      await connection.execute(`DELETE FROM abonos WHERE apartado_id = ?`, [apartadoId]);
      await connection.execute(`DELETE FROM apartados WHERE id = ?`, [apartadoId]);

      await connection.commit();

      return NextResponse.json({
        message: "Apartado liquidado eliminado permanentemente",
      });
    }

    // CASO 1: Eliminar venta del historial
    if (url.searchParams.get("deleteVenta") === "true") {
      if (!apartado.venta_id) {
        return NextResponse.json(
          { error: "Este apartado no tiene una venta asociada" },
          { status: 400 }
        );
      }

      await connection.execute(`DELETE FROM detalle_venta WHERE venta_id = ?`, [apartado.venta_id]);
      await connection.execute(`DELETE FROM ventas WHERE id = ?`, [apartado.venta_id]);
      await connection.execute(`UPDATE apartados SET venta_id = NULL WHERE id = ?`, [apartadoId]);

      await connection.commit();

      return NextResponse.json({
        message: "Venta eliminada del historial correctamente",
      });
    }

    // CASO 2: Eliminación permanente (solo para apartados cancelados)
    if (force) {
      if (apartado.estado !== "cancelado") {
        return NextResponse.json(
          { error: "Solo se pueden eliminar permanentemente apartados cancelados" },
          { status: 400 }
        );
      }

      await connection.execute(`DELETE FROM detalle_apartado WHERE apartado_id = ?`, [apartadoId]);
      await connection.execute(`DELETE FROM abonos WHERE apartado_id = ?`, [apartadoId]);
      await connection.execute(`DELETE FROM apartados WHERE id = ?`, [apartadoId]);

      await connection.commit();

      return NextResponse.json({
        message: "Apartado cancelado eliminado permanentemente",
      });
    }

    // CASO 3: Cancelar apartado (default)
    if (apartado.estado === "cancelado") {
      return NextResponse.json(
        { error: "Este apartado ya está cancelado" },
        { status: 400 }
      );
    }

    if (apartado.estado === "completado") {
      return NextResponse.json(
        { error: "No se puede cancelar un apartado liquidado. Use la opción 'Eliminar Apartado Liquidado'." },
        { status: 400 }
      );
    }

    // Devolver stock - ✅ CORREGIDO: Cambiar 'sucursal_id' por 'sucursal'
    const [detalles]: any = await connection.execute(
      `SELECT producto_id, entrada as cantidad 
       FROM detalle_apartado 
       WHERE apartado_id = ?`,
      [apartadoId]
    );

    for (const detalle of detalles) {
      await connection.execute(
        `UPDATE inventario_sucursal 
         SET stock = stock + ? 
         WHERE sucursal = ? AND producto_id = ?`,  // ✅ CAMBIADO: sucursal_id → sucursal
        [detalle.cantidad, apartado.sucursal_nombre, detalle.producto_id]  // ✅ Usamos el nombre de la sucursal
      );
    }

    // Cancelar apartado
    await connection.execute(
      `UPDATE apartados SET estado = 'cancelado' WHERE id = ?`,
      [apartadoId]
    );

    await connection.commit();

    return NextResponse.json({
      message: "Apartado cancelado y stock devuelto correctamente",
    });

  } catch (error) {
    await connection.rollback();
    console.error("Error al procesar la solicitud:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}