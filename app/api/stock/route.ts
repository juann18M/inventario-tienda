import { db } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await db.query(`
      SELECT
        i.id,
        i.variante_id AS producto,
        s.nombre AS sucursal,
        i.cantidad AS stock
      FROM inventario i
      JOIN sucursales s ON s.id = i.sucursal_id
    `);
    return new Response(JSON.stringify(rows), { status: 200 });
  } catch (error: any) {
    console.error("ERROR API /api/stock:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, nuevaCantidad } = await req.json();
    if (typeof id !== "number" || typeof nuevaCantidad !== "number") {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400 });
    }

    await db.query("UPDATE inventario SET cantidad = ? WHERE id = ?", [nuevaCantidad, id]);

    return new Response(JSON.stringify({ message: "Stock actualizado" }), { status: 200 });
  } catch (error: any) {
    console.error("ERROR PATCH /api/stock:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
