import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    // CAMBIAMOS DE request.json() a request.formData() para recibir archivos
    const formData = await request.formData();
    
    // Obtener campos del FormData
    const id = formData.get('id') as string;
    const nombre = formData.get('nombre') as string;
    const sku = formData.get('sku') as string;
    const categoria = formData.get('categoria') as string;
    const descripcion = formData.get('descripcion') as string;
    const talla = formData.get('talla') as string;
    const color = formData.get('color') as string; // ✅ NUEVO CAMPO
    const stock = parseInt(formData.get('stock') as string) || 0;
    const precio = parseFloat(formData.get('precio') as string) || 0;
    const sucursal = formData.get('sucursal') as string;
    
    // Procesar imagen
    const imagenFile = formData.get('imagen') as File | null;
    const imagenExistente = formData.get('imagen_existente') as string | null;
    
    console.log("📝 Datos recibidos para EDITAR producto:", {
      id,
      nombre,
      sku,
      categoria,
      descripcion,
      talla,
      color, // ✅ MOSTRAR COLOR
      stock,
      precio,
      sucursal,
      imagen: imagenFile ? imagenFile.name : (imagenExistente || 'Sin cambios')
    });

    // 1️⃣ Validación: ID requerido
    if (!id) {
      return NextResponse.json(
        { error: "ID del producto es requerido para editar" }, 
        { status: 400 }
      );
    }

    const productoId = Number(id);

    // 2️⃣ Verificar que el producto existe
    const [productoExistente]: any = await db.execute(
      "SELECT id, sku, imagen FROM productos WHERE id = ?",
      [productoId]
    );

    if (!productoExistente || productoExistente.length === 0) {
      return NextResponse.json(
        { error: `Producto con ID ${productoId} no encontrado` },
        { status: 404 }
      );
    }

    const productoActual = productoExistente[0];

    // 🔥 Normalizar SKU actual y nuevo
    const skuActualNormalizado = productoActual.sku?.trim().toUpperCase();
    const skuNuevoNormalizado = sku?.trim().toUpperCase() || null;

    console.log("SKU actual:", `"${skuActualNormalizado}"`);
    console.log("SKU nuevo :", `"${skuNuevoNormalizado}"`);
    console.log("¿Son iguales?:", skuActualNormalizado === skuNuevoNormalizado);

    // 3️⃣ Preparar datos normalizados
    const nombreNormalizado = nombre?.trim().toUpperCase() || null;
    const categoriaNormalizada = categoria?.trim().toUpperCase() || null;
    const descripcionNormalizada = descripcion?.trim() || null;
    const tallaNormalizada = talla?.trim().toUpperCase() || null;
    const colorNormalizado = color?.trim().toUpperCase() || null; // ✅ NUEVO
    const sucursalNormalizada = sucursal?.trim() || null;

    // 4️⃣ Procesar la imagen si se subió una nueva
    let imagenPath = productoActual.imagen; // Mantener imagen actual por defecto

    if (imagenFile && imagenFile.size > 0) {
      // Validar tipo de archivo
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!validTypes.includes(imagenFile.type)) {
        return NextResponse.json({ 
          error: 'Formato de imagen no válido. Use JPEG, PNG o WEBP' 
        }, { status: 400 });
      }

      // Validar tamaño (máximo 5MB)
      if (imagenFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ 
          error: 'La imagen no debe superar los 5MB' 
        }, { status: 400 });
      }

      try {
        const bytes = await imagenFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Crear nombre único para la imagen
        const extension = imagenFile.name.split('.').pop();
        const fileName = `${uuidv4()}.${extension}`;
        
        // Ruta relativa para guardar en public/uploads
        const relativePath = `/uploads/productos/${fileName}`;
        
        // Ruta absoluta en el servidor
        const publicDir = path.join(process.cwd(), 'public');
        const uploadDir = path.join(publicDir, 'uploads', 'productos');
        
        // Crear directorio si no existe
        await mkdir(uploadDir, { recursive: true });
        
        // Guardar archivo
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);
        
        imagenPath = relativePath;
        
        console.log(`✅ Nueva imagen guardada: ${imagenPath}`);
      } catch (error) {
        console.error('Error al guardar imagen:', error);
        return NextResponse.json({ 
          error: 'Error al subir la imagen' 
        }, { status: 500 });
      }
    }

    // 5️⃣ Verificar duplicado SOLO si el SKU cambió realmente
    if (
      skuNuevoNormalizado &&
      skuNuevoNormalizado !== skuActualNormalizado
    ) {
      console.log(`🔍 Verificando duplicado para SKU: "${skuNuevoNormalizado}"`);

      const [skuExistente]: any = await db.execute(
        "SELECT id FROM productos WHERE UPPER(TRIM(sku)) = ? AND id != ?",
        [skuNuevoNormalizado, productoId]
      );

      if (skuExistente.length > 0) {
        return NextResponse.json(
          { 
            error: "SKU duplicado",
            message: `El SKU "${skuNuevoNormalizado}" ya existe en otro producto.`,
            code: "DUPLICATE_SKU"
          }, 
          { status: 400 }
        );
      }
    }

    // 6️⃣ Actualizar producto CON color E imagen
    const query = `
      UPDATE productos 
      SET 
        nombre = COALESCE(?, nombre),
        sku = COALESCE(?, sku),
        categoria = COALESCE(?, categoria),
        descripcion = COALESCE(?, descripcion),
        talla = COALESCE(?, talla),
        color = COALESCE(?, color),     -- ✅ NUEVO CAMPO
        imagen = ?,                     -- ✅ NUEVO CAMPO
        stock = ?,
        precio = ?,
        sucursal = COALESCE(?, sucursal)
      WHERE id = ?
    `;

    const [result]: any = await db.execute(query, [
      nombreNormalizado,
      skuNuevoNormalizado,
      categoriaNormalizada,
      descripcionNormalizada,
      tallaNormalizada,
      colorNormalizado,    // ✅ NUEVO CAMPO
      imagenPath,          // ✅ NUEVO CAMPO
      stock,
      precio,
      sucursalNormalizada,
      productoId
    ]);

    console.log(`✅ Producto #${productoId} actualizado. Filas afectadas: ${result.affectedRows}`);
    console.log(`🎨 Color actualizado a: ${colorNormalizado || 'No especificado'}`);
    console.log(`🖼️ Imagen actualizada a: ${imagenPath}`);

    return NextResponse.json({ 
      success: true,
      message: "Producto actualizado correctamente",
      productoId: productoId,
      color: colorNormalizado,
      imagen: imagenPath
    });

  } catch (error: any) {
    console.error("❌ Error al editar producto:", error);

    if (error.code === "ER_DUP_ENTRY" || error.errno === 1062) {
      return NextResponse.json(
        { 
          error: "SKU duplicado",
          message: "El SKU ya existe en otro producto.",
          code: "DB_DUPLICATE_SKU"
        }, 
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: "Error al actualizar producto", 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}