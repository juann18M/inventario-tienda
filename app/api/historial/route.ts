import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const user: any = session.user;
    const rol = user.role.toLowerCase();

    // -------------------------
    // Parámetros
    // -------------------------
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");
    const usuarioId = searchParams.get("usuarioId");
    const sucursalId = searchParams.get("sucursalId");
    const metodoPago = searchParams.get("metodoPago");
    const cliente = searchParams.get("cliente");
    const pagina = Number(searchParams.get("pagina") || 1);
    const limite = Number(searchParams.get("limite") || 20);
    const offset = (pagina - 1) * limite;

    // -------------------------
    // WHERE (BASE)
    // -------------------------
    const whereConditions: string[] = [];
    const whereParams: any[] = [];

    // 🔒 Solo ventas visibles (no eliminadas lógicamente)
    whereConditions.push("v.visible_dashboard = 1");

    // -------------------------
    // Permisos por rol
    // -------------------------
    if (rol === "admin") {
      if (usuarioId) {
        const id = Number(usuarioId);
        if (!isNaN(id) && id > 0) {
          whereConditions.push("v.usuario_id = ?");
          whereParams.push(id);
        }
      }

      if (sucursalId) {
        const id = Number(sucursalId);
        if (!isNaN(id) && id > 0) {
          whereConditions.push("v.sucursal_id = ?");
          whereParams.push(id);
        }
      }
    } else {
      const userId = Number(user.id);
      const userSucursalId = Number(user.sucursal_id);

      if (isNaN(userId) || userId <= 0) {
        return NextResponse.json({ error: "ID de usuario inválido" }, { status: 400 });
      }

      if (isNaN(userSucursalId) || userSucursalId <= 0) {
        return NextResponse.json({ error: "ID de sucursal inválido" }, { status: 400 });
      }

      whereConditions.push("v.usuario_id = ?");
      whereParams.push(userId);

      whereConditions.push("v.sucursal_id = ?");
      whereParams.push(userSucursalId);
    }

    // -------------------------
    // Filtros opcionales
    // -------------------------
    if (fechaInicio) {
      whereConditions.push("DATE(v.fecha) >= ?");
      whereParams.push(fechaInicio);
    }

    if (fechaFin) {
      whereConditions.push("DATE(v.fecha) <= ?");
      whereParams.push(fechaFin);
    }

    if (metodoPago) {
      whereConditions.push("v.metodo_pago = ?");
      whereParams.push(metodoPago);
    } else {
      // ✅ INCLUIR VENTAS DE APARTADOS (método de pago = 'APARTADO')
      // No filtramos por método de pago, permitimos todos
    }

    if (cliente && cliente.trim() !== "") {
      whereConditions.push("(v.cliente LIKE ? OR a.cliente LIKE ?)");
      whereParams.push(`%${cliente}%`);
      whereParams.push(`%${cliente}%`);
    }

    // -------------------------
    // QUERY PRINCIPAL - INCLUYENDO APARTADOS
    // -------------------------
    let query = `
      SELECT 
        v.id,
        v.fecha,
        v.total,
        v.metodo_pago,
        CASE 
          WHEN v.metodo_pago = 'APARTADO' THEN COALESCE(a.cliente, 'Cliente de apartado')
          ELSE v.cliente
        END AS cliente,
        CASE 
          WHEN v.metodo_pago = 'APARTADO' THEN CONCAT('Apartado #', a.id, ' - Liquidado')
          ELSE v.observaciones
        END AS observaciones,
        u.nombre AS usuario_nombre,
        u.rol AS usuario_rol,
        s.nombre AS sucursal_nombre,
        COUNT(dv.id) AS cantidad_productos,
        CASE 
          WHEN v.metodo_pago = 'APARTADO' THEN true 
          ELSE false 
        END AS es_apartado,
        a.id AS apartado_id,
        a.cliente AS cliente_apartado,
        a.fecha AS fecha_apartado
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      LEFT JOIN sucursales s ON v.sucursal_id = s.id
      LEFT JOIN detalle_venta dv ON v.id = dv.venta_id
      LEFT JOIN apartados a ON v.id = a.venta_id
    `;

    if (whereConditions.length > 0) {
      query += " WHERE " + whereConditions.join(" AND ");
    }

    // ⚠️ SOLO ventas con productos
    query += `
      GROUP BY v.id, a.id, a.cliente, a.fecha
      HAVING COUNT(dv.id) > 0
      ORDER BY v.fecha DESC
      LIMIT ${limite} OFFSET ${offset}
    `;

    const [ventas]: any = await db.execute(query, whereParams);

    // Formatear las ventas para mostrar información clara
    const ventasFormateadas = ventas.map((venta: any) => ({
      ...venta,
      // Si es apartado, mostrar el cliente del apartado
      cliente_mostrar: venta.metodo_pago === 'APARTADO' 
        ? venta.cliente_apartado || venta.cliente
        : venta.cliente,
      // Formatear fecha
      fecha_formateada: new Date(venta.fecha).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }));

    // -------------------------
    // QUERY COUNT (CORRECTO)
    // -------------------------
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT v.id
        FROM ventas v
        LEFT JOIN detalle_venta dv ON v.id = dv.venta_id
        LEFT JOIN apartados a ON v.id = a.venta_id
        ${whereConditions.length ? "WHERE " + whereConditions.join(" AND ") : ""}
        GROUP BY v.id
        HAVING COUNT(dv.id) > 0
      ) t
    `;

    const [countResult]: any = await db.execute(countQuery, whereParams);
    const total = countResult[0]?.total || 0;

    // -------------------------
    // RESPONSE
    // -------------------------
    return NextResponse.json({
      success: true,
      ventas: ventasFormateadas,
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
      },
    });

  } catch (error: any) {
    console.error("❌ Error en API historial:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener historial",
        message: error.message,
      },
      { status: 500 }
    );
  }
}