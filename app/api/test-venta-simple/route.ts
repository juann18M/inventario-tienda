// app/api/test-venta-simple/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    console.log("🧪 Test de venta simple...");
    
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. Crear una venta de prueba
      const [ventaResult]: any = await connection.execute(
        `INSERT INTO ventas (usuario_id, sucursal_id, metodo_pago, fecha) 
         VALUES (1, 1, 'Efectivo', NOW())`
      );
      
      const ventaId = ventaResult.insertId;
      console.log(`✅ Venta de prueba creada: #${ventaId}`);
      
      // 2. Verificar producto con ID 8
      const [producto]: any = await connection.execute(
        `SELECT id, nombre, stock, precio FROM productos WHERE id = ?`,
        [8]
      );
      
      console.log(`📦 Producto 8:`, producto[0] || "No encontrado");
      
      // 3. Intentar insertar en detalle_venta
      if (producto[0]) {
        try {
          const [detalleResult]: any = await connection.execute(
            `INSERT INTO detalle_venta (venta_id, variante_id, cantidad, precio) 
             VALUES (?, ?, 1, ?)`,
            [ventaId, 8, producto[0].precio]
          );
          console.log(`✅ Detalle insertado: ID ${detalleResult.insertId}`);
        } catch (detalleError: any) {
          console.error("❌ Error insertando detalle:", detalleError.message);
          console.error("❌ Código:", detalleError.code);
        }
      }
      
      await connection.rollback(); // No guardar cambios
      console.log("🔄 Transacción revertida (solo prueba)");
      
      return NextResponse.json({
        success: true,
        venta_id: ventaId,
        producto: producto[0] || null,
        mensaje: "Prueba completada (sin cambios)"
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error: any) {
    console.error("❌ Error en test:", {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage
    });
    
    return NextResponse.json({
      error: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage
    }, { status: 500 });
  }
}