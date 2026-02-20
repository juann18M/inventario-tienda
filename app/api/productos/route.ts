import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// 🔹 OBTENER PRODUCTOS
export async function GET() {
  const [productos]: any = await db.query(`
    SELECT 
      p.id,
      p.codigo,
      p.nombre,
      p.categoria,
      p.imagen,
      v.id AS variante_id,
      v.talla,
      v.color,
      i.cantidad
    FROM productos p
    LEFT JOIN variantes v ON v.producto_id = p.id
    LEFT JOIN inventario i ON i.variante_id = v.id
    ORDER BY p.id DESC
  `);

  return NextResponse.json(productos);
}


// 🔥 CREAR PRODUCTO + VARIANTE + INVENTARIO
export async function POST(req: Request) {
  const formData = await req.formData();

  const codigo = formData.get("codigo") as string;
  const nombre = formData.get("nombre") as string;
  const categoria = formData.get("categoria") as string;
  const talla = formData.get("talla") as string;
  const color = formData.get("color") as string;
  const sucursalId = formData.get("sucursalId") as string;
  const stock = Number(formData.get("stock") || 0);
  const imagenFile = formData.get("imagen") as File;

  if (!codigo || !nombre || !categoria || !talla || !color || !sucursalId) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  let imagenPath = null;

  if (imagenFile && imagenFile.size > 0) {
    const bytes = await imagenFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = `${Date.now()}-${imagenFile.name}`;
    const path = `./public/uploads/${fileName}`;

    const fs = await import("fs/promises");
    await fs.writeFile(path, buffer);

    imagenPath = `/uploads/${fileName}`;
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [productoResult]: any = await conn.query(
      `INSERT INTO productos (codigo, nombre, categoria, imagen)
       VALUES (?, ?, ?, ?)`,
      [codigo, nombre, categoria, imagenPath]
    );

    const productoId = productoResult.insertId;

    const [varianteResult]: any = await conn.query(
      `INSERT INTO variantes (producto_id, talla, color)
       VALUES (?, ?, ?)`,
      [productoId, talla, color]
    );

    const varianteId = varianteResult.insertId;

    await conn.query(
      `INSERT INTO inventario (variante_id, sucursal_id, cantidad)
       VALUES (?, ?, ?)`,
      [varianteId, sucursalId, stock]
    );

    await conn.commit();

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    await conn.rollback();
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  } finally {
    conn.release();
  }
}
