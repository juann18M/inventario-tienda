import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const user: any = session.user;
    const rol = String(user.role || "").toLowerCase().trim();

    // =============================
    // ✅ PAGINACIÓN
    // =============================
    const pagina = Math.max(1, Number(searchParams.get("pagina")) || 1);
    const limite = Math.max(1, Number(searchParams.get("limite")) || 20);
    const offset = (pagina - 1) * limite;

    // =============================
    // ✅ FILTROS
    // =============================
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");
    const usuarioId = searchParams.get("usuarioId");
    let sucursalIdParam = searchParams.get("sucursalId");
    const metodoPago = searchParams.get("metodoPago");
    const cliente = searchParams.get("cliente");
    const verTodas = searchParams.get("verTodas") === "true";

    // Limpiar valores inválidos
    if (
      sucursalIdParam === "undefined" ||
      sucursalIdParam === "null" ||
      sucursalIdParam === ""
    ) {
      sucursalIdParam = null;
    }

    const whereConditions: string[] = [];
    const whereParams: any[] = [];

    // Solo ventas visibles
    whereConditions.push("v.visible_dashboard = 1");

    // =============================
    // ✅ LÓGICA DE SUCURSAL Y ROL (CORREGIDA)
    // =============================
    if (rol === "admin") {
      if (!verTodas) {
        // Usar sucursal del query o fallback a la del usuario
        const sucursalActiva = Number(
          sucursalIdParam || user.sucursal_id
        );

        if (!isNaN(sucursalActiva) && sucursalActiva > 0) {
          whereConditions.push("v.sucursal_id = ?");
          whereParams.push(sucursalActiva);
        }
      }

      // Filtro por usuario específico
      if (
        usuarioId &&
        usuarioId !== "undefined" &&
        usuarioId !== "null" &&
        usuarioId !== ""
      ) {
        const idU = Number(usuarioId);
        if (!isNaN(idU) && idU > 0) {
          whereConditions.push("v.usuario_id = ?");
          whereParams.push(idU);
        }
      }
    } else {
      // Usuarios normales: forzar su propia sucursal y su propio usuario
      whereConditions.push("v.usuario_id = ?");
      whereParams.push(Number(user.id) || 0);

      whereConditions.push("v.sucursal_id = ?");
      whereParams.push(Number(user.sucursal_id) || 0);
    }

    // =============================
    // ✅ FILTROS OPCIONALES
    // =============================
    if (fechaInicio && fechaInicio !== "undefined" && fechaInicio !== "null") {
      whereConditions.push("DATE(v.fecha) >= ?");
      whereParams.push(fechaInicio);
    }

    if (fechaFin && fechaFin !== "undefined" && fechaFin !== "null") {
      whereConditions.push("DATE(v.fecha) <= ?");
      whereParams.push(fechaFin);
    }

    if (
      metodoPago &&
      metodoPago !== "undefined" &&
      metodoPago !== "null" &&
      metodoPago.trim() !== ""
    ) {
      whereConditions.push("v.metodo_pago = ?");
      whereParams.push(metodoPago);
    }

    if (
      cliente &&
      cliente !== "undefined" &&
      cliente !== "null" &&
      cliente.trim() !== ""
    ) {
      whereConditions.push("(v.cliente LIKE ? OR a.cliente LIKE ?)");
      whereParams.push(`%${cliente}%`, `%${cliente}%`);
    }

    // =============================
    // ✅ QUERY PRINCIPAL
    // =============================
    let query = `
      SELECT 
        v.id,
        v.fecha,
        v.total,
        v.metodo_pago,
        v.sucursal_id,
        CASE
          WHEN v.metodo_pago = 'APARTADO' THEN COALESCE(a.cliente, 'Cliente de apartado')
          ELSE COALESCE(v.cliente, 'Sin cliente')
        END AS cliente,
        u.nombre AS usuario_nombre,
        u.rol AS usuario_rol,
        s.nombre AS sucursal_nombre,
        COUNT(DISTINCT dv.id) AS cantidad_productos,
        COALESCE(SUM(dv.cantidad), 0) AS unidades_totales,
        (v.metodo_pago = 'APARTADO') AS es_apartado,
        a.id AS apartado_id,
        a.cliente AS cliente_apartado
      FROM ventas v
      INNER JOIN usuarios u ON v.usuario_id = u.id
      INNER JOIN sucursales s ON v.sucursal_id = s.id
      LEFT JOIN detalle_venta dv ON v.id = dv.venta_id
      LEFT JOIN apartados a ON v.id = a.venta_id
    `;

    if (whereConditions.length) {
      query += " WHERE " + whereConditions.join(" AND ");
    }

    query += `
      GROUP BY v.id, a.id
      ORDER BY v.fecha DESC
      LIMIT ${limite} OFFSET ${offset}
    `;

    const [ventas] = await db.query(query, whereParams);

    // =============================
    // ✅ CONTADOR PARA PAGINACIÓN
    // =============================
    const countQuery = `
      SELECT COUNT(DISTINCT v.id) as total
      FROM ventas v
      LEFT JOIN apartados a ON v.id = a.venta_id
      ${whereConditions.length ? "WHERE " + whereConditions.join(" AND ") : ""}
    `;

    const [countResult] = await db.query(countQuery, whereParams);
    const total = (countResult as any[])[0]?.total || 0;

    return NextResponse.json({
      success: true,
      ventas: ventas || [],
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
      },
    });

  } catch (error: any) {
    console.error("❌ Error historial:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}