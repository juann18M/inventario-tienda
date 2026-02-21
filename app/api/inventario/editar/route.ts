import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // Obtener campos del FormData
    const id = formData.get('id') as string;
    const nombre = formData.get('nombre') as string;
    const sku = formData.get('sku') as string;
    const categoria = formData.get('categoria') as string;
    const descripcion = formData.get('descripcion') as string;
    const talla = formData.get('talla') as string;
    const color = formData.get('color') as string;
    const stock = parseInt(formData.get('stock') as string) || 0;
    const precio = parseFloat(formData.get('precio') as string) || 0;
    const sucursal = formData.get('sucursal') as string;
    
    // Procesar imagen
    const imagenFile = formData.get('imagen') as File | null;
    
    if (!id) {
      return NextResponse.json({ error: "ID del producto es requerido" }, { status: 400 });
    }

    const productoId = Number(id);

    // 1. Obtener el producto actual para saber qué imagen tiene
    const [productoExistente]: any = await db.execute(
      "SELECT id, sku, imagen FROM productos WHERE id = ?",
      [productoId]
    );

    if (!productoExistente || productoExistente.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const productoActual = productoExistente[0];
    let imagenFinal = productoActual.imagen; // Por defecto mantenemos la vieja

    // 2. Procesar nueva imagen si se subió una (Base64 para Vercel)
    if (imagenFile && imagenFile.size > 0) {
      if (imagenFile.size > 4 * 1024 * 1024) {
        return NextResponse.json({ error: 'La imagen es demasiado grande (máx 4MB)' }, { status: 400 });
      }

      try {
        const bytes = await imagenFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        imagenFinal = `data:${imagenFile.type};base64,${buffer.toString('base64')}`;
      } catch (err) {
        console.error('Error al procesar nueva imagen:', err);
        return NextResponse.json({ error: 'Error al procesar la imagen' }, { status: 500 });
      }
    }

    // 3. Normalizar datos para la actualización
    const nombreNormalizado = nombre?.trim().toUpperCase() || null;
    const skuNuevoNormalizado = sku?.trim().toUpperCase() || null;

    // 4. Actualizar en la base de datos
    const query = `
      UPDATE productos 
      SET 
        nombre = COALESCE(?, nombre),
        sku = COALESCE(?, sku),
        categoria = COALESCE(?, categoria),
        descripcion = COALESCE(?, descripcion),
        talla = COALESCE(?, talla),
        color = COALESCE(?, color),
        imagen = ?, 
        stock = ?,
        precio = ?,
        sucursal = COALESCE(?, sucursal)
      WHERE id = ?
    `;

    await db.execute(query, [
      nombreNormalizado,
      skuNuevoNormalizado,
      categoria?.trim().toUpperCase() || null,
      descripcion?.trim() || null,
      talla?.trim().toUpperCase() || null,
      color?.trim().toUpperCase() || null,
      imagenFinal, // El nuevo Base64 o el link anterior
      stock,
      precio,
      sucursal?.trim() || null,
      productoId
    ]);

    return NextResponse.json({ 
      success: true,
      message: "Producto actualizado correctamente",
      imagen: imagenFinal
    });

  } catch (error: any) {
    console.error("❌ Error al editar producto:", error);
    return NextResponse.json({ error: "Error al actualizar", details: error.message }, { status: 500 });
  }
}