import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unlink } from 'fs/promises';
import path from 'path';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const productoId = params.id;
    
    console.log(`🗑️ Solicitando eliminación de producto #${productoId}`);

    if (!productoId || isNaN(Number(productoId))) {
      return NextResponse.json(
        { error: "ID de producto inválido" },
        { status: 400 }
      );
    }

    // Verificar que el producto existe y obtener la imagen para eliminarla
    const [productoExistente]: any = await db.execute(
      "SELECT id, nombre, imagen FROM productos WHERE id = ?",
      [productoId]
    );

    if (productoExistente.length === 0) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const nombreProducto = productoExistente[0].nombre;
    const imagenPath = productoExistente[0].imagen;
    
    console.log(`🗑️ Eliminando: ${nombreProducto} (ID: ${productoId})`);
    if (imagenPath) {
      console.log(`🖼️ Producto tiene imagen: ${imagenPath}`);
    }

    // Primero intentar eliminar variantes asociadas (si la tabla existe)
    try {
      const [variantesEliminadas]: any = await db.execute(
        `DELETE FROM variantes WHERE producto_id = ?`,
        [productoId]
      );
      console.log(`✅ ${variantesEliminadas.affectedRows} variante(s) eliminada(s)`);
    } catch (varianteError: any) {
      // Si la tabla no existe o hay error, continuamos
      console.warn("ℹ️ No se pudieron eliminar variantes:", varianteError.message);
    }

    // Eliminar el producto de la base de datos
    const [result]: any = await db.execute(
      `DELETE FROM productos WHERE id = ?`,
      [productoId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "No se pudo eliminar el producto" },
        { status: 500 }
      );
    }

    // ✅ ELIMINAR LA IMAGEN DEL SISTEMA DE ARCHIVOS
    if (imagenPath) {
      try {
        // Construir la ruta absoluta del archivo
        const filePath = path.join(process.cwd(), 'public', imagenPath);
        await unlink(filePath);
        console.log(`✅ Imagen eliminada: ${filePath}`);
      } catch (fileError: any) {
        // Si el archivo no existe, solo logueamos el error pero no fallamos la operación
        console.warn(`⚠️ No se pudo eliminar la imagen: ${fileError.message}`);
      }
    }

    console.log(`✅ Producto #${productoId} eliminado exitosamente`);

    return NextResponse.json({ 
      success: true,
      message: `Producto "${nombreProducto}" eliminado correctamente`,
      productoId: productoId,
      imagenEliminada: !!imagenPath
    });

  } catch (error: any) {
    console.error("❌ Error al eliminar producto:", error);
    
    // Verificar si es error de FK (producto tiene ventas asociadas)
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.message.includes('foreign key constraint')) {
      return NextResponse.json(
        { 
          error: "No se puede eliminar el producto porque tiene ventas registradas",
          suggestion: "Puedes desactivar el producto en lugar de eliminarlo"
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "No se pudo eliminar el producto", 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}