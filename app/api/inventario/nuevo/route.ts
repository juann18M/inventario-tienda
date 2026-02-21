import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // Obtener campos del FormData
    const nombre = formData.get('nombre') as string;
    const sku = formData.get('sku') as string;
    const categoria = formData.get('categoria') as string;
    const descripcion = formData.get('descripcion') as string;
    const talla = formData.get('talla') as string;
    const color = formData.get('color') as string;
    const stock = parseInt(formData.get('stock') as string) || 0;
    const precio = parseFloat(formData.get('precio') as string) || 0;
    const sucursal = formData.get('sucursal') as string;
    
    // Procesar imagen (Cambiado de 'imagen' a 'fotografia' según tu UI anterior, 
    // pero mantengo 'imagen' si así viene del formulario)
    const imagenFile = formData.get('imagen') as File | null;
    let imagenData = null;

    // Log de depuración para Vercel
    console.log("📝 Procesando nuevo producto:", { nombre, sku, sucursal });

    // Validaciones básicas
    if (!nombre || !sku) {
      return NextResponse.json({ error: "Nombre y SKU son requeridos" }, { status: 400 });
    }

    // --- PROCESAMIENTO DE IMAGEN PARA VERCEL (BASE64) ---
    if (imagenFile && imagenFile.size > 0) {
      // Validar tamaño para no sobrecargar la DB (Límite 4MB recomendado)
      if (imagenFile.size > 4 * 1024 * 1024) {
        return NextResponse.json({ error: 'La imagen es demasiado grande (máx 4MB)' }, { status: 400 });
      }

      try {
        const bytes = await imagenFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        // Convertimos a String Base64 para guardarlo en la columna LONGTEXT
        imagenData = `data:${imagenFile.type};base64,${buffer.toString('base64')}`;
      } catch (err) {
        console.error('❌ Error al procesar imagen:', err);
        return NextResponse.json({ error: 'Error al procesar la imagen' }, { status: 500 });
      }
    }

    // VERIFICAR SKU DUPLICADO
    const [existing]: any = await db.execute(
      "SELECT id FROM productos WHERE sku = ?",
      [sku]
    );

    if (existing.length > 0) {
      return NextResponse.json({ 
        error: "SKU duplicado", 
        message: `El SKU "${sku}" ya existe.` 
      }, { status: 400 });
    }

    // INSERTAR EN LA BASE DE DATOS
    const query = `
      INSERT INTO productos 
      (nombre, sku, categoria, descripcion, talla, color, imagen, stock, precio, sucursal, activo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    const [result]: any = await db.execute(query, [
      nombre, 
      sku, 
      categoria, 
      descripcion || null, 
      talla || null, 
      color || null,
      imagenData, // Aquí se guarda el string de la imagen
      stock, 
      precio, 
      sucursal
    ]);

    return NextResponse.json({ 
      success: true,
      message: "Producto creado exitosamente",
      productoId: result.insertId
    });

  } catch (error: any) {
    console.error("❌ Error crítico:", error);
    return NextResponse.json({ 
      error: "Error interno del servidor", 
      details: error.message 
    }, { status: 500 });
  }
}