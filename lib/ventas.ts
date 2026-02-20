import { db } from "@/lib/db";

interface ProductoVenta {
  varianteId: number; // ← en realidad es productoId
  cantidad: number;
}

interface CrearVentaParams {
  usuarioId: number;
  sucursalId: number;
  metodoPago: string;
  cliente: string | null;
  observaciones: string | null;
  productos: ProductoVenta[];
}

export async function crearVenta({
  usuarioId,
  sucursalId,
  metodoPago,
  cliente,
  observaciones,
  productos,
}: CrearVentaParams): Promise<number> {

  console.log("=".repeat(60));
  console.log("🔄 [VENTAS] Iniciando creación de venta");
  console.log("=".repeat(60));

  const connection = await db.getConnection();
  console.log("🔌 Conexión obtenida");

  try {
    await connection.beginTransaction();
    console.log("✅ Transacción iniciada");

    let totalVenta = 0;
    const detallesProductos: any[] = [];

    for (const item of productos) {
      console.log(`🔍 Procesando productoId=${item.varianteId}`);

      const [rows]: any = await connection.execute(
        `SELECT 
          id,
          nombre,
          precio,
          stock
        FROM productos
        WHERE id = ?
          AND stock >= ?
          AND precio > 0
        FOR UPDATE`,
        [item.varianteId, item.cantidad]
      );

      if (rows.length === 0) {
        throw new Error(
          `❌ Producto inválido, sin stock o con precio 0 (ID ${item.varianteId})`
        );
      }

      const producto = rows[0];
      const subtotal = producto.precio * item.cantidad;
      totalVenta += subtotal;

      detallesProductos.push({
        producto_id: producto.id, // ← se guarda como variante_id en detalle_venta
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: item.cantidad,
      });

      console.log(
        `✅ Producto OK: ${producto.nombre} | $${producto.precio} x ${item.cantidad}`
      );
    }

    console.log(`💰 TOTAL CALCULADO: $${totalVenta}`);

    const [ventaResult]: any = await connection.execute(
      `INSERT INTO ventas
       (usuario_id, sucursal_id, metodo_pago, cliente, observaciones, fecha, total)
       VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
      [usuarioId, sucursalId, metodoPago, cliente, observaciones, totalVenta]
    );

    const ventaId = ventaResult.insertId;
    console.log(`📋 Venta #${ventaId} creada`);

    for (const detalle of detallesProductos) {
      // 👇 USAMOS variante_id (porque producto_id NO existe en la tabla)
      await connection.execute(
        `INSERT INTO detalle_venta
         (venta_id, variante_id, cantidad, precio)
         VALUES (?, ?, ?, ?)`,
        [ventaId, detalle.producto_id, detalle.cantidad, detalle.precio]
      );

      const [update]: any = await connection.execute(
        `UPDATE productos
         SET stock = stock - ?
         WHERE id = ?
           AND stock >= ?`,
        [detalle.cantidad, detalle.producto_id, detalle.cantidad]
      );

      if (update.affectedRows === 0) {
        throw new Error(`❌ Error al descontar stock: ${detalle.nombre}`);
      }

      console.log(`📉 Stock actualizado: ${detalle.nombre}`);
    }

    await connection.commit();
    console.log(`🎉 VENTA #${ventaId} COMPLETADA`);
    return ventaId;

  } catch (error: any) {
    await connection.rollback();
    console.error("❌ ERROR:", error.message);
    throw error;
  } finally {
    connection.release();
    console.log("🔓 Conexión liberada");
  }
}
