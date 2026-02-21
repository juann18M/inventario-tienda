import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/* =========================
   GET - Obtener caja ABIERTA
========================= */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const user = session.user as any;
    const sucursalId = Number(user.sucursal_id);

    if (!sucursalId) {
      return NextResponse.json(
        { error: "Usuario sin sucursal asignada" },
        { status: 400 }
      );
    }

    const [rows]: any = await db.query(
      `
      SELECT *
      FROM cajas
      WHERE sucursal_id = ?
      AND fecha_cierre IS NULL
      ORDER BY fecha_apertura DESC
      LIMIT 1
      `,
      [sucursalId]
    );

    return NextResponse.json({ data: rows });

  } catch (error) {
    console.error("❌ Error GET caja:", error);
    return NextResponse.json(
      { error: "Error al obtener caja" },
      { status: 500 }
    );
  }
}

/* =========================
   POST - Abrir Caja
========================= */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { monto_inicial } = await req.json();

    if (!monto_inicial || Number(monto_inicial) <= 0) {
      return NextResponse.json(
        { error: "Monto inicial inválido" },
        { status: 400 }
      );
    }

    const user = session.user as any;
    const usuarioId = Number(user.id);
    const sucursalId = Number(user.sucursal_id);

    if (!sucursalId) {
      return NextResponse.json(
        { error: "Usuario sin sucursal asignada" },
        { status: 400 }
      );
    }

    // 🔍 Verificar si ya existe caja ABIERTA
    const [existente]: any = await db.query(
      `
      SELECT id FROM cajas
      WHERE sucursal_id = ?
      AND estado = 'ABIERTA'
      LIMIT 1
      `,
      [sucursalId]
    );

    if (existente.length) {
      return NextResponse.json(
        { error: "Ya hay una caja abierta en esta sucursal" },
        { status: 400 }
      );
    }

    // 🟢 Crear caja
    const [result]: any = await db.query(
      `
      INSERT INTO cajas
      (sucursal_id, usuario_id, monto_inicial, monto_final,
       total_ventas, total_apartados,
       fecha_apertura, estado)
      VALUES (?, ?, ?, ?, 0, 0, NOW(), 'ABIERTA')
      `,
      [
        sucursalId,
        usuarioId,
        Number(monto_inicial),
        Number(monto_inicial),
      ]
    );

    return NextResponse.json({
      success: true,
      id: result.insertId,
    });

  } catch (error) {
    console.error("❌ Error POST abrir caja:", error);
    return NextResponse.json(
      { error: "Error al abrir caja" },
      { status: 500 }
    );
  }
}

/* =========================
   PATCH - Cerrar Caja
========================= */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id, monto_final } = await req.json();

    if (!id || monto_final === undefined) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 400 }
      );
    }

    const [rows]: any = await db.query(
      "SELECT * FROM cajas WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      return NextResponse.json(
        { error: "Caja no encontrada" },
        { status: 404 }
      );
    }

    const caja = rows[0];

    const esperado =
      Number(caja.monto_inicial) +
      Number(caja.total_ventas);

    const diferencia =
      Number(monto_final) - esperado;

    await db.query(
      `
      UPDATE cajas
      SET monto_final = ?,
          diferencia = ?,
          fecha_cierre = NOW(),
          estado = 'CERRADA'
      WHERE id = ?
      `,
      [Number(monto_final), diferencia, id]
    );

    return NextResponse.json({
      success: true,
      diferencia,
    });

  } catch (error) {
    console.error("❌ Error PATCH cerrar caja:", error);
    return NextResponse.json(
      { error: "Error al cerrar caja" },
      { status: 500 }
    );
  }
}