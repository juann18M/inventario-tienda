import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET - Obtiene la caja del día
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sucursalFiltro = searchParams.get("sucursal");

  const rol = String((session.user as any).role || "").toLowerCase();
  const sucursalUsuario = (session.user as any).sucursal;

  const sucursal =
    rol === "admin" && sucursalFiltro ? sucursalFiltro : sucursalUsuario;

  if (!sucursal) {
    return NextResponse.json(
      { error: "Sucursal no especificada" },
      { status: 400 }
    );
  }

  try {
    const [rows]: any = await db.query(
      `
      SELECT 
        c.id,
        c.monto_inicial,
        c.monto_final,
        c.fecha,
        c.total_ventas,
        c.total_apartados,
        c.observaciones,
        s.nombre AS sucursal,
        (
          SELECT IFNULL(SUM(v.total), 0)
          FROM ventas v
          WHERE v.sucursal_id = s.id
          AND DATE(v.fecha) = CURDATE()
        ) AS ventas_hoy,
        (
          SELECT COUNT(*)
          FROM ventas v
          WHERE v.sucursal_id = s.id
          AND DATE(v.fecha) = CURDATE()
        ) AS cantidad_ventas
      FROM cajas c
      JOIN sucursales s ON c.sucursal_id = s.id
      WHERE s.nombre = ?
      AND DATE(c.fecha) = CURDATE()
      ORDER BY c.fecha DESC
      LIMIT 1
      `,
      [sucursal]
    );

    return NextResponse.json({
      data: rows,
    });
  } catch (error) {
    console.error("Error en GET caja:", error);
    return NextResponse.json({ error: "Error en GET" }, { status: 500 });
  }
}

/**
 * POST - Abre la caja (monto inicial)
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { monto_inicial, sucursal } = await req.json();

    if (!monto_inicial || monto_inicial <= 0) {
      return NextResponse.json(
        { error: "El monto inicial debe ser mayor a 0" },
        { status: 400 }
      );
    }

    const [suc]: any = await db.query(
      "SELECT id FROM sucursales WHERE nombre = ?",
      [sucursal]
    );

    if (suc.length === 0) {
      return NextResponse.json(
        { error: "Sucursal no encontrada" },
        { status: 404 }
      );
    }

    const sucursalId = suc[0].id;
    const usuarioId = (session.user as any).id;

    // Verificar si ya hay caja hoy
    const [cajaExistente]: any = await db.query(
      `SELECT id FROM cajas 
       WHERE sucursal_id = ? 
       AND DATE(fecha) = CURDATE()
       LIMIT 1`,
      [sucursalId]
    );

    if (cajaExistente.length > 0) {
      return NextResponse.json(
        {
          error: "Ya existe una caja para hoy",
          id: cajaExistente[0].id,
        },
        { status: 400 }
      );
    }

    const [result]: any = await db.query(
      `
      INSERT INTO cajas 
      (sucursal_id, usuario_id, monto_inicial, monto_final, total_ventas, total_apartados, fecha)
      VALUES (?, ?, ?, ?, 0, 0, NOW())
      `,
      [sucursalId, usuarioId, monto_inicial, monto_inicial]
    );

    return NextResponse.json({
      success: true,
      id: result.insertId,
      monto_inicial,
      monto_final: monto_inicial,
      message: "Caja aperturada correctamente",
    });
  } catch (error) {
    console.error("Error en POST caja:", error);
    return NextResponse.json({ error: "Error en POST" }, { status: 500 });
  }
}

/**
 * PATCH - Actualiza monto inicial / final
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id, monto_inicial, monto_final } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID de caja requerido" },
        { status: 400 }
      );
    }

    const [rows]: any = await db.query(
      "SELECT * FROM cajas WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Caja no encontrada" },
        { status: 404 }
      );
    }

    const caja = rows[0];

    const nuevoInicial =
      monto_inicial !== undefined ? monto_inicial : caja.monto_inicial;

    const nuevoFinal =
      monto_final !== undefined ? monto_final : caja.monto_final;

    await db.query(
      `
      UPDATE cajas
      SET monto_inicial = ?, monto_final = ?
      WHERE id = ?
      `,
      [nuevoInicial, nuevoFinal, id]
    );

    return NextResponse.json({
      success: true,
      message: "Caja actualizada correctamente",
      monto_inicial: nuevoInicial,
      monto_final: nuevoFinal,
    });
  } catch (error) {
    console.error("Error en PATCH caja:", error);
    return NextResponse.json({ error: "Error en PATCH" }, { status: 500 });
  }
}
