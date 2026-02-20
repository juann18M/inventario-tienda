import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    // Cambiamos de request.json() a request.formData() para recibir archivos
    const formData = await request.formData();
    
    // Obtener campos del FormData
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
    let imagenPath = null;

    console.log("📝 Datos recibidos para crear producto:", {
      nombre,
      sku,
      categoria,
      descripcion,
      talla,
      color, // ✅ MOSTRAR COLOR
      stock,
      precio,
      sucursal,
      imagen: imagenFile ? imagenFile.name : 'Sin imagen'
    });

    // Si viene con ID, es una edición que llegó al endpoint equivocado
    const id = formData.get('id');
    if (id) {
      console.log("⚠️ ADVERTENCIA: Se recibió ID en endpoint /nuevo");
      console.log("📞 Esto debería ser una edición. ID:", id, "SKU:", sku);
      
      return NextResponse.json(
        { 
          error: "Endpoint incorrecto",
          message: "Los productos con ID deben editarse en /api/inventario/editar",
          tip: "El frontend debe usar /editar cuando hay ID",
          receivedId: id
        }, 
        { status: 400 }
      );
    }

    // Validaciones básicas
    if (!nombre || !sku) {
      return NextResponse.json(
        { error: "Nombre y SKU son requeridos" }, 
        { status: 400 }
      );
    }

    // Procesar la imagen si se subió una
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
        
        console.log(`✅ Imagen guardada: ${imagenPath}`);
      } catch (error) {
        console.error('Error al guardar imagen:', error);
        return NextResponse.json({ 
          error: 'Error al subir la imagen' 
        }, { status: 500 });
      }
    }

    console.log(`🔍 Verificando si SKU "${sku}" ya existe...`);
    
    // VERIFICAR SI EL SKU YA EXISTE
    const [existingProducts]: any = await db.execute(
      "SELECT id, nombre FROM productos WHERE sku = ?",
      [sku]
    );

    if (existingProducts.length > 0) {
      const existingProduct = existingProducts[0];
      console.error(`❌ SKU duplicado: "${sku}" ya existe en el producto #${existingProduct.id} (${existingProduct.nombre})`);
      
      return NextResponse.json(
        { 
          error: "SKU duplicado",
          message: `El SKU "${sku}" ya está asignado al producto "${existingProduct.nombre}". Por favor, usa un SKU único.`,
          existingProductId: existingProduct.id,
          existingProductName: existingProduct.nombre,
          code: "DUPLICATE_SKU"
        }, 
        { status: 400 }
      );
    }

    console.log(`✅ SKU "${sku}" está disponible. Creando producto...`);

    // ✅ QUERY ACTUALIZADA CON color E imagen
    const query = `
      INSERT INTO productos 
      (nombre, sku, categoria, descripcion, talla, color, imagen, stock, precio, sucursal, activo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    const [result]: any = await db.execute(query, [
      nombre, 
      sku, 
      categoria, 
      descripcion, 
      talla || null, 
      color || null,       // ✅ NUEVO CAMPO
      imagenPath,          // ✅ NUEVO CAMPO
      stock, 
      precio, 
      sucursal
    ]);

    const productoId = result.insertId;

    console.log(`✅ Producto #${productoId} creado exitosamente con SKU: ${sku}`);
    console.log(`🎨 Color: ${color || 'No especificado'}`);
    console.log(`🖼️ Imagen: ${imagenPath || 'Sin imagen'}`);

    return NextResponse.json({ 
      success: true,
      message: "Producto creado correctamente",
      productoId: productoId,
      sku: sku,
      color: color,
      imagen: imagenPath
    });

  } catch (error: any) {
    console.error("❌ Error al crear producto:", error);
    
    // Manejar error específico de duplicado de MySQL
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      const skuMatch = error.message.match(/'([^']+)'/);
      const duplicateSku = skuMatch ? skuMatch[1] : "desconocido";
      
      return NextResponse.json(
        { 
          error: "SKU duplicado (error de base de datos)",
          message: `El SKU "${duplicateSku}" ya existe en la base de datos.`,
          code: "DB_DUPLICATE_SKU",
          details: "Por seguridad, verifica que no haya productos con el mismo SKU."
        }, 
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "No se pudo crear el producto", 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}