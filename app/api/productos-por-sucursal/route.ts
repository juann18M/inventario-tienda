import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sucursalId = searchParams.get('sucursalId');
  
  if (!sucursalId) {
    return NextResponse.json({ error: "Sucursal no especificada" }, { status: 400 });
  }

  const connection = await db.getConnection();

  try {
    // Obtener nombre de la sucursal
    const [sucursalRows]: any = await connection.execute(
      `SELECT nombre FROM sucursales WHERE id = ?`,
      [sucursalId]
    );
    
    if (sucursalRows.length === 0) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }
    
    const nombreSucursal = sucursalRows[0].nombre;
    
    // Obtener productos de ESA sucursal
    const [productosRows]: any = await connection.execute(
      `SELECT 
        id as producto_id,
        id as variante_id,
        nombre,
        precio,
        NULL as talla,
        NULL as color,
        stock,
        imagen,
        sku,
        categoria,
        descripcion
       FROM productos 
       WHERE sucursal = ? AND stock > 0 AND activo = 1
       ORDER BY nombre`,
      [nombreSucursal]
    );

    return NextResponse.json(productosRows);
  } catch (error) {
    console.error("Error al cargar productos:", error);
    return NextResponse.json({ error: "Error al cargar productos" }, { status: 500 });
  } finally {
    connection.release();
  }
}