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
    const userRole = user?.role?.toLowerCase?.() ?? "";
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

      // Solo admin/jefe ven todo
      if (userRole !== "admin" && userRole !== "jefe") {
        query += ` AND c.usuario_id = ?`;
        params.push(user.id);
      }

      query += ` ORDER BY c.fecha DESC, c.id DESC`;

      const [rows] = await db.query(query, params);

      return NextResponse.json({ data: rows });
    }

    /* ================= CAJA ABIERTA ================= */
    const [rows] = await db.query(
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

    return NextResponse.json({ data: rows });
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

    const user = session.user as any;

    if (isNaN(montoInicial) || montoInicial < 0) {
      return NextResponse.json(
        { error: "Monto inicial inválido" },
        { status: 400 }
      );
    }

    /* ===== Verificar caja abierta ===== */
    const [existente]: any = await db.query(
      `
      SELECT id FROM cajas
      WHERE sucursal_id = ?
      AND estado = 'ABIERTA'
      LIMIT 1
      `,
      [user.sucursal_id]
    );

    if (existente.length > 0) {
      return NextResponse.json(
        { error: "Ya existe una caja abierta" },
        { status: 400 }
      );
    }

    /* ===== Crear caja ===== */
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

    /* ===== Movimiento ===== */
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
    console.error("❌ Error POST abrir caja:", error);

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
    const montoInicial = body.monto_inicial;
    const montoFinal = body.monto_final;

    const user = session.user as any;

    if (!id) {
      return NextResponse.json(
        { error: "ID inválido" },
        { status: 400 }
      );
    }

    const [rows]: any = await db.query(
      `SELECT * FROM cajas WHERE id = ?`,
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
      const nuevoMonto = Number(montoInicial);

      if (isNaN(nuevoMonto)) {
        return NextResponse.json(
          { error: "Monto inválido" },
          { status: 400 }
        );
      }

      const diferencia =
        nuevoMonto - Number(caja.monto_inicial);

      await db.query(
        `
        UPDATE cajas
        SET monto_inicial = ?,
            monto_final = monto_final + ?
        WHERE id = ?
        `,
        [nuevoMonto, diferencia, id]
      );

      await db.query(
        `
        INSERT INTO movimientos_caja
        (caja_id, tipo, monto, descripcion, usuario_id)
        VALUES (?, 'AJUSTE_INICIAL', ?, ?, ?)
        `,
        [
          id,
          diferencia,
          "Ajuste de monto inicial",
          user.id,
        ]
      );

      return NextResponse.json({ success: true });
    }

    /* ================= CIERRE CAJA ================= */
    if (montoFinal !== undefined) {
      const montoSistema = Number(caja.monto_final);
      const declarado = Number(montoFinal);

      if (isNaN(declarado)) {
        return NextResponse.json(
          { error: "Monto final inválido" },
          { status: 400 }
        );
      }

      const diferencia = declarado - montoSistema;

      await db.query(
        `
        UPDATE cajas
        SET monto_final = ?,
            estado = 'CERRADA',
            fecha_cierre = NOW()
        WHERE id = ?
        `,
        [declarado, id]
      );

      await db.query(
        `
        INSERT INTO movimientos_caja
        (caja_id, tipo, monto, descripcion, usuario_id)
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