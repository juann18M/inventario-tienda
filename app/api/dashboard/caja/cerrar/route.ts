import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { monto_final } = await req.json();
  const monto = Number(monto_final);

  const user = session.user as any;

  /* buscar caja abierta */
  const [rows]: any = await db.query(
    `SELECT id FROM cajas
     WHERE sucursal_id=? AND estado='ABIERTA'
     LIMIT 1`,
    [user.sucursal_id]
  );

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No hay caja abierta" },
      { status: 400 }
    );
  }

  const cajaId = rows[0].id;

  /* cerrar caja */
  await db.query(
    `UPDATE cajas
     SET monto_final=?, estado='CERRADA'
     WHERE id=?`,
    [monto, cajaId]
  );

  return NextResponse.json({
    success: true,
  });
}