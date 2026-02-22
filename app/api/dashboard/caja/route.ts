import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // Asegúrate que esta ruta sea correcta
import { db } from "@/lib/db"; // Asegúrate que esta ruta sea correcta

/* =====================================================
   GET — Obtener Caja
===================================================== */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const user = session.user as any;
    
    // Prioridad: parámetro URL > sesión
    const sucursalId = searchParams.get("sucursal_id") || user.sucursal_id;

    if (!sucursalId) {
      return NextResponse.json({ error: "Falta sucursal_id" }, { status: 400 });
    }

    // Consulta para obtener la caja ABIERTA actual
    const [rows]: any = await db.query(
      `
      SELECT c.*, u.nombre AS usuario_nombre
      FROM cajas c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.sucursal_id = ?
      AND c.estado = 'ABIERTA'
      ORDER BY c.id DESC
      LIMIT 1
      `,
      [sucursalId]
    );

    // CORRECCIÓN 1: Devolver formato { caja: objeto } para que coincida con el frontend
    const caja = rows && rows.length > 0 ? rows[0] : null;
    
    return NextResponse.json({ 
      caja: caja,
      success: true 
    });

  } catch (error) {
    console.error("❌ Error GET caja:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* =====================================================
   POST — Abrir Caja
===================================================== */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const montoInicial = Number(body.monto_inicial);
    const user = session.user as any;
    
    // CORRECCIÓN 2: Usar sucursal_id del body si la sesión falla
    const sucursalId = user.sucursal_id || body.sucursal_id;

    if (!sucursalId) return NextResponse.json({ error: "Sin sucursal asignada" }, { status: 400 });

    // Verificar si ya existe
    const [existente]: any = await db.query(
      `SELECT id FROM cajas WHERE sucursal_id = ? AND estado = 'ABIERTA' LIMIT 1`,
      [sucursalId]
    );

    if (existente.length > 0) {
      return NextResponse.json({ error: "Ya existe una caja abierta en esta sucursal" }, { status: 400 });
    }

    // Insertar Caja
    const [result]: any = await db.query(
      `
      INSERT INTO cajas
      (sucursal_id, usuario_id, fecha, monto_inicial, monto_final, total_ventas, total_transacciones, total_apartados, estado, observaciones)
      VALUES (?, ?, NOW(), ?, ?, 0, 0, 0, 'ABIERTA', ?)
      `,
      [sucursalId, user.id, montoInicial, montoInicial, "Apertura de caja"]
    );

    // CORRECCIÓN 3: Ajustar parámetros del INSERT de movimientos (SQL Crash fix)
    // Asumiendo tabla: (caja_id, tipo, monto, descripcion, usuario_id, fecha)
    await db.query(
      `INSERT INTO movimientos_caja (caja_id, tipo, monto, descripcion, usuario_id, fecha) VALUES (?, 'APERTURA', ?, ?, ?, NOW())`,
      [result.insertId, montoInicial, "Apertura de caja", user.id]
    );

    return NextResponse.json({ success: true, id: result.insertId });

  } catch (error) {
    console.error("❌ Error POST caja:", error);
    return NextResponse.json({ error: "Error al abrir caja" }, { status: 500 });
  }
}

/* =====================================================
   PATCH — Cerrar o Actualizar
===================================================== */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const id = Number(body.id);
    const montoInicial = body.monto_inicial !== undefined ? Number(body.monto_inicial) : undefined;
    const montoFinal = body.monto_final !== undefined ? Number(body.monto_final) : undefined;
    const user = session.user as any;

    if (!id) return NextResponse.json({ error: "ID faltante" }, { status: 400 });

    const [rows]: any = await db.query("SELECT * FROM cajas WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) return NextResponse.json({ error: "Caja no encontrada" }, { status: 404 });
    
    const caja = rows[0];

    // --- OPCIÓN A: ACTUALIZAR MONTO INICIAL ---
    if (montoInicial !== undefined && montoInicial !== Number(caja.monto_inicial)) {
      const diferencia = montoInicial - Number(caja.monto_inicial);
      
      await db.query(
        `UPDATE cajas SET monto_inicial = ?, monto_final = monto_final + ? WHERE id = ?`,
        [montoInicial, diferencia, id]
      );

      // CORRECCIÓN SQL Crash
      await db.query(
        `INSERT INTO movimientos_caja (caja_id, tipo, monto, descripcion, usuario_id, fecha) VALUES (?, 'AJUSTE_INICIAL', ?, ?, ?, NOW())`,
        [id, diferencia, `Ajuste inicial: ${diferencia}`, user.id]
      );

      return NextResponse.json({ success: true });
    }

    // --- OPCIÓN B: CERRAR CAJA (Monto Final) ---
    if (montoFinal !== undefined) {
      if (caja.estado === "CERRADA") return NextResponse.json({ error: "Caja ya cerrada" }, { status: 400 });

      const diferencia = montoFinal - Number(caja.monto_final);

      await db.query(
        `UPDATE cajas SET monto_final = ?, estado = 'CERRADA', fecha_cierre = NOW() WHERE id = ?`,
        [montoFinal, id]
      );

      // CORRECCIÓN SQL Crash
      await db.query(
        `INSERT INTO movimientos_caja (caja_id, tipo, monto, descripcion, usuario_id, fecha) VALUES (?, 'CIERRE', ?, ?, ?, NOW())`,
        [id, diferencia, `Cierre: ${diferencia}`, user.id]
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true }); // Sin cambios

  } catch (error) {
    console.error("❌ Error PATCH caja:", error);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}