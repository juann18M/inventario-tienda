import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2/promise";

// 1. Forzamos que sea dinámica para que Next no intente pre-renderizarla como estática
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Sucursal {
  nombre: string;
}

interface Inventario {
  stock: number;
  sucursal: Sucursal;
}

interface Producto {
  id: number;
  nombre: string;
  inventarios?: Inventario[];
}

export async function POST(req: Request) {
  try {
    // 2. Verificación de API Key (Evita que truene si no existe en el build)
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API Key no configurada" }, { status: 500 });
    }

    // Inicializamos dentro del POST para asegurar que las variables de entorno estén listas
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const bytes = await req.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe el producto en esta imagen de forma corta y específica (ejemplo: playera nike blanca talla M).",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });

    const descripcion = visionResponse.choices[0].message.content?.toLowerCase() || "";
    const palabra = descripcion.split(" ")[0]; 

    // 3. Validación de la DB antes de la consulta
    if (!db) {
      throw new Error("La conexión a la base de datos no está disponible");
    }

    const [rows] = await db.query<(Producto & RowDataPacket)[]>(
      `SELECT * FROM productos WHERE nombre LIKE ? LIMIT 5`,
      [`%${palabra}%`]
    );

    const productos: Producto[] = rows as Producto[];

    if (!productos.length) {
      return NextResponse.json({
        respuesta: `Detecté: "${descripcion}" pero no encontré coincidencias en inventario.`,
        productos: [],
      });
    }

    const resultado = productos.map((p: Producto) => {
      const sucursalesStr = p.inventarios
        ?.filter((i) => i.stock > 0)
        .map((i) => i.sucursal.nombre)
        .join(", ");

      return `${p.nombre} disponible en: ${sucursalesStr || "Sin stock"}`;
    });

    return NextResponse.json({
      respuesta: `Detecté: "${descripcion}".\n\n${resultado.join("\n")}`,
      productos: productos,
    });

  } catch (error: any) {
    console.error("Error en /api/vision:", error);
    return NextResponse.json(
      { error: "Error procesando imagen", details: error.message }, 
      { status: 500 }
    );
  }
}