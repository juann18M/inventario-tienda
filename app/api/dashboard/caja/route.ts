import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/* =========================
   GET - Obtener caja actual o historial
========================= */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sucursal = searchParams.get("sucursal");
    const historial = searchParams.get("historial") === "true";
    const empleadoId = searchParams.get("empleadoId");
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");

    const user = session.user as any;
    const userRole = user.role?.toLowerCase();

    // Si es historial
    if (historial) {
      let query = `
        SELECT 
          c.*,
          u.nombre as usuario_nombre,
          s.nombre as sucursal_nombre,
          DATE_FORMAT(c.fecha_apertura, '%Y-%m-%d %H:%i:%s') as fecha_apertura,
          DATE_FORMAT(c.fecha_cierre, '%Y-%m-%d %H:%i:%s') as fecha_cierre
        FROM cajas c
        JOIN usuarios u ON c.usuario_id = u.id
        JOIN sucursales s ON c.sucursal_id = s.id
        WHERE 1=1
      `;
      
      const params: any[] = [];

      // Filtros
      if (userRole === 'admin') {
        if (sucursal) {
          query += ` AND s.nombre = ?`;
          params.push(sucursal);
        }
        if (empleadoId) {
          query += ` AND c.usuario_id = ?`;
          params.push(empleadoId);
        }
      } else {
        // Empleado solo ve su historial
        query += ` AND c.usuario_id = ?`;
        params.push(user.id);
      }

      if (fechaInicio) {
        query += ` AND DATE(c.fecha_apertura) >= ?`;
        params.push(fechaInicio);
      }
      if (fechaFin) {
        query += ` AND DATE(c.fecha_apertura) <= ?`;
        params.push(fechaFin);
      }

      query += ` ORDER BY c.fecha_apertura DESC`;

      const [rows]: any = await db.query(query, params);
      return NextResponse.json({ data: rows });
    }

    // Si no es historial, obtener caja ABIERTA
    const sucursalId = searchParams.get("sucursalId") || user.sucursal_id;

    if (!sucursalId) {
      return NextResponse.json(
        { error: "Usuario sin sucursal asignada" },
        { status: 400 }
      );
    }

    const [rows]: any = await db.query(
      `
      SELECT c.*, u.nombre as usuario_nombre
      FROM cajas c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.sucursal_id = ?
      AND c.estado = 'ABIERTA'
      ORDER BY c.fecha_apertura DESC
      LIMIT 1
      `,
      [Number(sucursalId)]
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
    const { monto_inicial, sucursal } = await req.json();

    if (!monto_inicial || Number(monto_inicial) <= 0) {
      return NextResponse.json(
        { error: "Monto inicial inválido" },
        { status: 400 }
      );
    }

    const user = session.user as any;
    const usuarioId = Number(user.id);
    let sucursalId = Number(user.sucursal_id);

    // Si es admin y envió sucursal por nombre, buscar el ID
    if (user.role?.toLowerCase() === 'admin' && sucursal) {
      const [sucursalRows]: any = await db.query(
        "SELECT id FROM sucursales WHERE nombre = ?",
        [sucursal]
      );
      if (sucursalRows.length) {
        sucursalId = sucursalRows[0].id;
      }
    }

    if (!sucursalId) {
      return NextResponse.json(
        { error: "Usuario sin sucursal asignada" },
        { status: 400 }
      );
    }

    // Verificar si ya existe caja ABIERTA
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

    // Crear caja
    const [result]: any = await db.query(
      `
      INSERT INTO cajas
      (sucursal_id, usuario_id, monto_inicial, monto_final,
       total_ventas, total_apartados, diferencia,
       fecha_apertura, estado)
      VALUES (?, ?, ?, ?, 0, 0, 0, NOW(), 'ABIERTA')
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
   PATCH - Actualizar/Cerrar Caja
========================= */
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

    if (!rows.length) {
      return NextResponse.json(
        { error: "Caja no encontrada" },
        { status: 404 }
      );
    }

    const caja = rows[0];

    // Si solo actualiza monto inicial
    if (monto_inicial !== undefined && monto_final === undefined) {
      await db.query(
        `
        UPDATE cajas
        SET monto_inicial = ?,
            monto_final = ?
        WHERE id = ?
        `,
        [Number(monto_inicial), Number(monto_inicial), id]
      );

      return NextResponse.json({
        success: true,
        message: "Monto inicial actualizado",
      });
    }

    // Si está cerrando caja
    if (monto_final !== undefined) {
      const esperado =
        Number(caja.monto_inicial) +
        Number(caja.total_ventas || 0);

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