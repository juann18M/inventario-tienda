import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const [movimientos] = await db.query(`
    SELECT 
      m.id,
      p.nombre AS producto,
      s.nombre AS sucursal,
      m.tipo_movimiento,
      m.cantidad,
      m.observacion,
      m.created_at
    FROM movimientos_inventario m
    JOIN productos p ON p.id = m.id_producto
    JOIN sucursales s ON s.id = m.id_sucursal
    ORDER BY m.created_at DESC
  `);

  return NextResponse.json(movimientos);
}

export async function POST(req: Request) {
  const {
    id_producto,
    id_sucursal,
    tipo_movimiento,
    cantidad,
    observacion
  } = await req.json();

  await db.query(
    `INSERT INTO movimientos_inventario
     (id_producto, id_sucursal, tipo_movimiento, cantidad, observacion)
     VALUES (?, ?, ?, ?, ?)`,
    [id_producto, id_sucursal, tipo_movimiento, cantidad, observacion]
  );

  return NextResponse.json({ ok: true });
}
