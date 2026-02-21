import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/* =====================================================
   GET — Caja actual o historial
===================================================== */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const historial = searchParams.get("historial") === "true";

    const user = session.user as any;
    const role = user?.role?.toLowerCase?.() ?? "";
    const sucursalId = Number(user?.sucursal_id);

    if (!sucursalId) {
      return NextResponse.json(
        { error: "Usuario sin sucursal asignada" },
        { status: 400 }
      );
    }

    /* ================= HISTORIAL ================= */
    if (historial) {
      let query = `
        SELECT c.*, u.nombre AS usuario_nombre
        FROM cajas c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE 1=1
      `;

      const params: any[] = [];

      if (role !== "admin" && role !== "jefe") {
        query += ` AND c.usuario_id = ?`;
        params.push(user.id);
      }

      query += ` ORDER BY c.fecha DESC, c.id DESC`;

      const [rows]: any = await db.query(query, params);

      return NextResponse.json({ data: rows ?? [] });
    }

    /* ================= CAJA ABIERTA ================= */
    const [rows]: any = await db.query(
      `
      SELECT c.*, u.nombre AS usuario_nombre
      FROM cajas c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.sucursal_id = ?
      AND c.estado = 'ABIERTA'
      ORDER BY c.id DESC
      LIMIT 1
      `,
      [sucursalId]
    );

    return NextResponse.json({ data: rows ?? [] });
  } catch (error) {
    console.error("❌ Error GET caja:", error);

    return NextResponse.json(
      { error: "Error al obtener caja" },
      { status: 500 }
    );
  }
}

/* =====================================================
   POST — Abrir Caja
===================================================== */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const montoInicial = Number(body.monto_inicial);

    if (!Number.isFinite(montoInicial) || montoInicial < 0) {
      return NextResponse.json(
        { error: "Monto inicial inválido" },
        { status: 400 }
      );
    }

    const user = session.user as any;

    /* ===== verificar caja abierta ===== */
    const [existente]: any = await db.query(
      `SELECT id FROM cajas
       WHERE sucursal_id = ?
       AND estado='ABIERTA'
       LIMIT 1`,
      [user.sucursal_id]
    );

    if (existente.length > 0) {
      return NextResponse.json(
        { error: "Ya existe una caja abierta" },
        { status: 400 }
      );
    }

    /* ===== crear caja ===== */
    const [result]: any = await db.query(
      `
      INSERT INTO cajas
      (sucursal_id, usuario_id, fecha,
       monto_inicial, monto_final,
       total_ventas, total_transacciones,
       total_apartados, estado, observaciones)
      VALUES (?, ?, CURDATE(), ?, ?, 0, 0, 0, 'ABIERTA', ?)
      `,
      [
        user.sucursal_id,
        user.id,
        montoInicial,
        montoInicial,
        "Apertura de caja",
      ]
    );

    /* ===== movimiento ===== */
    await db.query(
      `
      INSERT INTO movimientos_caja
      (caja_id, tipo, monto, descripcion, usuario_id)
      VALUES (?, 'APERTURA', ?, ?, ?)
      `,
      [result.insertId, montoInicial, "Apertura de caja", user.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Error POST caja:", error);

    return NextResponse.json(
      { error: "Error al abrir caja" },
      { status: 500 }
    );
  }
}

/* =====================================================
   PATCH — Ajustar o Cerrar Caja
===================================================== */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const id = Number(body.id);
    const montoInicial =
      body.monto_inicial !== undefined
        ? Number(body.monto_inicial)
        : undefined;

    const montoFinal =
      body.monto_final !== undefined
        ? Number(body.monto_final)
        : undefined;

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: "ID inválido" },
        { status: 400 }
      );
    }

    const user = session.user as any;

    const [rows]: any = await db.query(
      `SELECT * FROM cajas WHERE id=? LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return NextResponse.json(
        { error: "Caja no encontrada" },
        { status: 404 }
      );
    }

    const caja = rows[0];

    /* ================= AJUSTE INICIAL ================= */
    if (montoInicial !== undefined && montoFinal === undefined) {
      if (!Number.isFinite(montoInicial)) {
        return NextResponse.json(
          { error: "Monto inválido" },
          { status: 400 }
        );
      }

      const diferencia =
        montoInicial - Number(caja.monto_inicial);

      await db.query(
        `
        UPDATE cajas
        SET monto_inicial=?,
            monto_final=monto_final+?
        WHERE id=?
        `,
        [montoInicial, diferencia, id]
      );

      await db.query(
        `
        INSERT INTO movimientos_caja
        (caja_id,tipo,monto,descripcion,usuario_id)
        VALUES (?, 'AJUSTE_INICIAL', ?, ?, ?)
        `,
        [id, diferencia, "Ajuste monto inicial", user.id]
      );

      return NextResponse.json({ success: true });
    }

    /* ================= CIERRE CAJA ================= */
    if (montoFinal !== undefined) {
      if (caja.estado === "CERRADA") {
        return NextResponse.json(
          { error: "La caja ya está cerrada" },
          { status: 400 }
        );
      }

      if (!Number.isFinite(montoFinal)) {
        return NextResponse.json(
          { error: "Monto final inválido" },
          { status: 400 }
        );
      }

      const diferencia =
        montoFinal - Number(caja.monto_final);

      await db.query(
        `
        UPDATE cajas
        SET monto_final=?,
            estado='CERRADA',
            fecha_cierre=NOW()
        WHERE id=?
        `,
        [montoFinal, id]
      );

      await db.query(
        `
        INSERT INTO movimientos_caja
        (caja_id,tipo,monto,descripcion,usuario_id)
        VALUES (?, 'CIERRE', ?, ?, ?)
        `,
        [
          id,
          diferencia,
          `Cierre de caja. Diferencia: ${diferencia}`,
          user.id,
        ]
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Operación no válida" },
      { status: 400 }
    );
  } catch (error) {
    console.error("❌ Error PATCH caja:", error);

    return NextResponse.json(
      { error: "Error al actualizar caja" },
      { status: 500 }
    );
  }
}