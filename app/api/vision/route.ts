import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";

// 🔑 Inicializamos OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// 🔹 Interfaces para tipado
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
  inventarios: Inventario[];
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No se recibió imagen" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");

    // 🔥 1. Mandar imagen a OpenAI Vision
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
                url: `data:${file.type};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });

    const descripcion = visionResponse.choices[0].message.content?.toLowerCase() || "";
    console.log("Detectado:", descripcion);

    // 🔥 2. Buscar en la base de datos
    const palabra = descripcion.split(" ")[0];

    // ✅ Tipado correcto de db.query
    const [productos] = await db.query<Producto[]>(
      `
      SELECT *
      FROM productos
      WHERE nombre LIKE ?
      LIMIT 5
      `,
      [`%${palabra}%`]
    );

    if (!productos.length) {
      return NextResponse.json({
        respuesta: `Detecté: "${descripcion}" pero no encontré coincidencias en inventario.`,
      });
    }

    // 🔥 3. Armar respuesta
    const resultado = productos.map((p: Producto) => {
      const sucursales = p.inventarios
        .filter((i) => i.stock > 0)
        .map((i) => i.sucursal.nombre)
        .join(", ");

      return `${p.nombre} disponible en: ${sucursales || "Sin stock"}`;
    });

    return NextResponse.json({
      respuesta: `Detecté: "${descripcion}".\n\n${resultado.join("\n")}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error procesando imagen" }, { status: 500 });
  }
}