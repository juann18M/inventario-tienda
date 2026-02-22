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
          u.rol as usuario_rol,
          s.nombre as sucursal_nombre
        FROM cajas c
        JOIN usuarios u ON c.usuario_id = u.id
        JOIN sucursales s ON c.sucursal_id = s.id
        WHERE 1=1
      `;
      
      const params: any[] = [];

      // Filtros - admin y jefe pueden ver todo
      if (userRole === 'admin' || userRole === 'jefe') {
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
        query += ` AND c.fecha >= ?`;
        params.push(fechaInicio);
      }
      if (fechaFin) {
        query += ` AND c.fecha <= ?`;
        params.push(fechaFin);
      }

      query += ` ORDER BY c.fecha DESC, c.id DESC`;

      const [rows]: any = await db.query(query, params);
      return NextResponse.json({ data: rows });
    }

    // Si no es historial, obtener caja ABIERTA del día actual
    const sucursalId = user.sucursal_id;

    if (!sucursalId) {
      return NextResponse.json(
        { error: "Usuario sin sucursal asignada" },
        { status: 400 }
      );
    }

    // Una caja está abierta si monto_final ES IGUAL a monto_inicial (aún no se ha cerrado)
    const [rows]: any = await db.query(
  `
  SELECT c.*, u.nombre as usuario_nombre
  FROM cajas c
  JOIN usuarios u ON c.usuario_id = u.id
  WHERE c.sucursal_id = ?
  AND c.estado = 'ABIERTA'
  ORDER BY c.id DESC
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

    // Si es admin/jefe y envió sucursal por nombre, buscar el ID
    const userRole = user.role?.toLowerCase();
    if ((userRole === 'admin' || userRole === 'jefe') && sucursal) {
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

    // Verificar si ya existe caja ABIERTA hoy (monto_final = monto_inicial)
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
      // Si existe, devolvemos sus datos
      const [cajaExistente]: any = await db.query(
        "SELECT * FROM cajas WHERE id = ?",
        [existente[0].id]
      );
      return NextResponse.json({ 
        error: "Ya existe una caja abierta hoy",
        data: cajaExistente[0]
      }, { status: 400 });
    }

    // Crear caja
    const [result]: any = await db.query(
      `
      INSERT INTO cajas
      (sucursal_id, usuario_id, fecha, monto_inicial, monto_final,
       total_ventas, total_apartados, observaciones)
      VALUES (?, ?, CURDATE(), ?, ?, 0, 0, ?)
      `,
      [
        sucursalId,
        usuarioId,
        Number(monto_inicial),
        Number(monto_inicial),
        `Apertura de caja - ${new Date().toLocaleTimeString()}`
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
  SET monto_final = ?,
      estado = 'CERRADA',
      fecha_cierre = NOW(),
      observaciones = CONCAT(IFNULL(observaciones,''), ' | Cierre: $', ?)
  WHERE id = ?
  `,
  [Number(monto_final), Number(monto_final), id]
);

      return NextResponse.json({
        success: true,
        message: "Monto inicial actualizado",
      });
    }

    // Si está cerrando caja
    if (monto_final !== undefined) {
     await db.query(
  `
  UPDATE cajas
  SET monto_final = ?,
      estado = 'CERRADA',
      observaciones = CONCAT(observaciones, ' | Cierre: $', ?, ' ', NOW())
  WHERE id = ?
  `,
  [Number(monto_final), Number(monto_final), id]
);

      return NextResponse.json({
        success: true,
        message: "Caja cerrada correctamente",
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