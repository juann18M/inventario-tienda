import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const id = formData.get("id") as string;
    const nombre = formData.get("nombre") as string;
    const sku = formData.get("sku") as string;
    const categoria = formData.get("categoria") as string;
    const descripcion = formData.get("descripcion") as string;
    const talla = formData.get("talla") as string;
    const color = formData.get("color") as string;
    const stock = parseInt(formData.get("stock") as string) || 0;
    const precio = parseFloat(formData.get("precio") as string) || 0;
    const sucursal = formData.get("sucursal") as string;
    const imagenFile = formData.get("imagen") as File | null;

    if (!id) {
      return NextResponse.json(
        { error: "ID del producto es requerido" },
        { status: 400 }
      );
    }

    const productoId = Number(id);

    // 🔎 1. Obtener producto actual
    const [productoExistente]: any = await db.execute(
      "SELECT id, sku, sucursal, imagen FROM productos WHERE id = ?",
      [productoId]
    );

    if (!productoExistente || productoExistente.length === 0) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const productoActual = productoExistente[0];
    let imagenFinal = productoActual.imagen;

    // 🖼 2. Procesar nueva imagen si existe
    if (imagenFile && imagenFile.size > 0) {
      if (imagenFile.size > 4 * 1024 * 1024) {
        return NextResponse.json(
          { error: "La imagen es demasiado grande (máx 4MB)" },
          { status: 400 }
        );
      }

      const bytes = await imagenFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      imagenFinal = `data:${imagenFile.type};base64,${buffer.toString("base64")}`;
    }

    // 🧼 3. Normalizar datos del formulario
    const nombreNormalizado = nombre?.trim().toUpperCase() || null;
    const skuNormalizado = sku?.trim().toUpperCase() || null;
    const categoriaNormalizada = categoria?.trim().toUpperCase() || null;
    const tallaNormalizada = talla?.trim().toUpperCase() || null;
    const colorNormalizado = color?.trim().toUpperCase() || null;
    const sucursalNormalizada = sucursal?.trim() || null;

    // 🧠 4. Normalizar datos actuales de base de datos
    const skuActualNormalizado =
      productoActual.sku?.trim().toUpperCase();
    const sucursalActualNormalizada =
      productoActual.sucursal?.trim();

    // 🎯 5. Determinar valores finales reales
    const skuFinal = skuNormalizado ?? skuActualNormalizado;
    const sucursalFinal =
      sucursalNormalizada ?? sucursalActualNormalizada;

    const skuCambio = skuFinal !== skuActualNormalizado;
    const sucursalCambio =
      sucursalFinal !== sucursalActualNormalizada;

    // 🚨 6. Validar duplicado SOLO si realmente cambió algo
    if (skuCambio || sucursalCambio) {
      const [duplicado]: any = await db.execute(
        `
        SELECT id FROM productos 
        WHERE UPPER(TRIM(sku)) = ? 
        AND TRIM(sucursal) = ? 
        AND id != ?
        `,
        [skuFinal, sucursalFinal, productoId]
      );

      if (duplicado.length > 0) {
        return NextResponse.json(
          {
            error:
              "Ya existe un producto con ese SKU en esta sucursal",
          },
          { status: 400 }
        );
      }
    }

    // 🛠 7. Actualizar producto
    await db.execute(
      `
      UPDATE productos 
      SET 
        nombre = COALESCE(?, nombre),
        sku = ?,
        categoria = COALESCE(?, categoria),
        descripcion = COALESCE(?, descripcion),
        talla = COALESCE(?, talla),
        color = COALESCE(?, color),
        imagen = ?, 
        stock = ?,
        precio = ?,
        sucursal = ?
      WHERE id = ?
      `,
      [
        nombreNormalizado,
        skuFinal,
        categoriaNormalizada,
        descripcion?.trim() || null,
        tallaNormalizada,
        colorNormalizado,
        imagenFinal,
        stock,
        precio,
        sucursalFinal,
        productoId,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "Producto actualizado correctamente",
      imagen: imagenFinal,
    });
  } catch (error: any) {
    console.error("❌ Error al editar producto:", error);

    return NextResponse.json(
      {
        error: "Error al actualizar producto",
        details: error.message,
      },
      { status: 500 }
    );
  }
}