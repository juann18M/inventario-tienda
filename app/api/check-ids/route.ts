// app/api/check-ids/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    console.log("🔍 Verificando IDs en la base de datos...");
    
    // 1. Todos los productos con sus IDs
    const [productos]: any = await db.execute(
      "SELECT id, nombre, stock, precio, sucursal FROM productos ORDER BY id"
    );
    
    // 2. Todas las variantes
    const [variantes]: any = await db.execute(
      "SELECT v.id as variante_id, v.producto_id, p.nombre FROM variantes v JOIN productos p ON v.producto_id = p.id"
    );
    
    // 3. Verificar si existe ID 8 y ID 9
    const [producto8]: any = await db.execute(
      "SELECT * FROM productos WHERE id = 8"
    );
    
    const [producto9]: any = await db.execute(
      "SELECT * FROM productos WHERE id = 9"
    );
    
    // 4. Verificar qué devuelve el inventario API
    const [inventarioRaw]: any = await db.execute(
      `SELECT 
        p.id as producto_id,
        p.nombre,
        p.sku,
        p.stock,
        p.precio,
        p.sucursal,
        v.id as variante_id
       FROM productos p
       LEFT JOIN variantes v ON p.id = v.producto_id
       WHERE p.sucursal LIKE '%Isidro%'
       ORDER BY p.id`
    );
    
    return NextResponse.json({
      productos_total: productos.length,
      productos_lista: productos.map((p: any) => ({ id: p.id, nombre: p.nombre, stock: p.stock })),
      variantes_total: variantes.length,
      variantes_lista: variantes,
      producto_id_8: producto8[0] || "NO EXISTE",
      producto_id_9: producto9[0] || "NO EXISTE",
      inventario_crudo: inventarioRaw,
      analisis: {
        tiene_producto_8: producto8.length > 0,
        tiene_producto_9: producto9.length > 0,
        ids_disponibles: productos.map((p: any) => p.id)
      }
    });
    
  } catch (error: any) {
    console.error("❌ Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}