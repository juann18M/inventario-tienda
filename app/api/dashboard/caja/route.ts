import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/* ============================
   GET CAJA ABIERTA
============================ */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as any;

  const [rows]: any = await db.query(
    `SELECT * FROM cajas
     WHERE sucursal_id=? AND estado='ABIERTA'
     ORDER BY id DESC
     LIMIT 1`,
    [user.sucursal_id]
  );

  return NextResponse.json({
    data: rows[0] ?? null,
  });
}

/* ============================
   ABRIR CAJA
============================ */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { monto_inicial } = await req.json();
  const monto = Number(monto_inicial);

  const user = session.user as any;

  const [existente]: any = await db.query(
    `SELECT id FROM cajas
     WHERE sucursal_id=? AND estado='ABIERTA'
     LIMIT 1`,
    [user.sucursal_id]
  );

  if (existente.length > 0) {
    return NextResponse.json({ error: "Caja ya abierta" }, { status: 400 });
  }

  const [result]: any = await db.query(
    `INSERT INTO cajas
     (sucursal_id,usuario_id,fecha,monto_inicial,monto_final,estado)
     VALUES (?, ?, CURDATE(), ?, ?, 'ABIERTA')`,
    [user.sucursal_id, user.id, monto, monto]
  );

  return NextResponse.json({
    success: true,
    monto_inicial: monto,
    id: result.insertId,
  });
}