// app/api/reportes/resumen/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    console.log("🔵 Iniciando consulta de reportes...");
    
    // Obtener parámetros de la URL
    const { searchParams } = new URL(request.url);
    const sucursalId = searchParams.get('sucursal_id');
    const periodo = searchParams.get('periodo') || '7dias';

    console.log("📊 Filtros aplicados:", { sucursalId, periodo });

    // Construir filtros SQL
    let filtroVentas = "WHERE v.total > 0";
    let filtroDetalle = "WHERE 1=1";
    let filtroVentasPorDia = "WHERE v.total > 0";
    let filtroMetodoPago = "WHERE v.total > 0";
    let filtroTopProductos = "WHERE 1=1";
    let filtroEmpleado = "WHERE v.total > 0";
    let filtroSucursal = "WHERE v.total > 0";
    
    // Filtrar por sucursal si se especificó
    if (sucursalId && sucursalId !== 'todas') {
      const filtro = ` AND v.sucursal_id = ${parseInt(sucursalId)}`;
      filtroVentas += filtro;
      filtroVentasPorDia += filtro;
      filtroMetodoPago += filtro;
      filtroEmpleado += filtro;
      filtroSucursal += filtro;
      filtroTopProductos += ` AND v.sucursal_id = ${parseInt(sucursalId)}`;
    }

    // Calcular fecha según período
    let intervaloFecha = "7 DAY";
    switch(periodo) {
      case '7dias':
        intervaloFecha = "7 DAY";
        break;
      case '30dias':
        intervaloFecha = "30 DAY";
        break;
      case '90dias':
        intervaloFecha = "90 DAY";
        break;
    }

    // Agregar filtro de fecha
    filtroVentas += ` AND v.fecha >= DATE_SUB(CURDATE(), INTERVAL ${intervaloFecha})`;
    filtroVentasPorDia += ` AND v.fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
    filtroTopProductos += ` AND v.fecha >= DATE_SUB(CURDATE(), INTERVAL ${intervaloFecha})`;

    // Consulta de ventas totales
    const [ventas] = await db.query<any[]>(`
      SELECT 
        COUNT(*) as total_ventas,
        COALESCE(SUM(v.total), 0) as monto_total
      FROM ventas v
      ${filtroVentas}
    `);

    // Consulta de productos vendidos
    const [productos] = await db.query<any[]>(`
      SELECT 
        COALESCE(SUM(dv.cantidad), 0) as productos_vendidos
      FROM detalle_venta dv
      JOIN ventas v ON v.id = dv.venta_id
      ${filtroVentas.replace('WHERE v.', 'WHERE ')}
    `);

    // Consulta de ventas por día
    const [ventasPorDia] = await db.query<any[]>(`
      SELECT 
        DATE(v.fecha) as dia,
        COUNT(*) as cantidad_ventas,
        COALESCE(SUM(v.total), 0) as total
      FROM ventas v
      ${filtroVentasPorDia}
      GROUP BY DATE(v.fecha)
      ORDER BY dia ASC
    `);

    // Consulta de ventas por método de pago
    const [ventasPorMetodo] = await db.query<any[]>(`
      SELECT 
        v.metodo_pago,
        COUNT(*) as cantidad,
        COALESCE(SUM(v.total), 0) as total
      FROM ventas v
      ${filtroMetodoPago}
      GROUP BY v.metodo_pago
    `);

    // Consulta de top productos
    const [topProductos] = await db.query<any[]>(`
      SELECT 
        p.nombre,
        SUM(dv.cantidad) as total_vendido,
        SUM(dv.precio * dv.cantidad) as total_generado
      FROM detalle_venta dv
      JOIN productos p ON p.id = dv.variante_id
      JOIN ventas v ON v.id = dv.venta_id
      ${filtroTopProductos}
      GROUP BY p.id, p.nombre
      ORDER BY total_vendido DESC
      LIMIT 5
    `);

    // Consulta de empleado destacado
    const [empleado] = await db.query<any[]>(`
      SELECT 
        u.nombre, 
        COALESCE(SUM(v.total), 0) as total,
        COUNT(*) as ventas_realizadas
      FROM ventas v
      JOIN usuarios u ON u.id = v.usuario_id
      ${filtroEmpleado}
      GROUP BY u.id, u.nombre
      ORDER BY total DESC
      LIMIT 1
    `);

    // Consulta de sucursal destacada
    let sucursalQuery = '';
    if (sucursalId && sucursalId !== 'todas') {
      // Si ya filtramos por una sucursal, esa será la destacada
      sucursalQuery = `
        SELECT 
          s.nombre, 
          COALESCE(SUM(v.total), 0) as total,
          COUNT(*) as ventas_realizadas
        FROM ventas v
        JOIN sucursales s ON s.id = v.sucursal_id
        WHERE v.sucursal_id = ${parseInt(sucursalId)}
          AND v.total > 0
          AND v.fecha >= DATE_SUB(CURDATE(), INTERVAL ${intervaloFecha})
        GROUP BY s.id, s.nombre
      `;
    } else {
      // Si no hay filtro, obtener la mejor sucursal
      sucursalQuery = `
        SELECT 
          s.nombre, 
          COALESCE(SUM(v.total), 0) as total,
          COUNT(*) as ventas_realizadas
        FROM ventas v
        JOIN sucursales s ON s.id = v.sucursal_id
        WHERE v.total > 0
          AND v.fecha >= DATE_SUB(CURDATE(), INTERVAL ${intervaloFecha})
        GROUP BY s.id, s.nombre
        ORDER BY total DESC
        LIMIT 1
      `;
    }
    const [sucursal] = await db.query<any[]>(sucursalQuery);

    // Consulta de ventas por mes
    const [ventasPorMes] = await db.query<any[]>(`
      SELECT 
        DATE_FORMAT(v.fecha, '%Y-%m') as mes,
        COUNT(*) as cantidad_ventas,
        COALESCE(SUM(v.total), 0) as total
      FROM ventas v
      ${filtroVentas}
      GROUP BY DATE_FORMAT(v.fecha, '%Y-%m')
      ORDER BY mes DESC
      LIMIT 6
    `);

    const response = {
      ventas: ventas[0] || { total_ventas: 0, monto_total: 0 },
      productos: productos[0] || { productos_vendidos: 0 },
      ventasPorDia: ventasPorDia || [],
      ventasPorMetodo: ventasPorMetodo || [],
      topProductos: topProductos || [],
      empleadoTop: empleado[0] || { nombre: "Sin datos", total: 0, ventas_realizadas: 0 },
      sucursalTop: sucursal[0] || { nombre: "Sin datos", total: 0, ventas_realizadas: 0 },
      ventasPorMes: ventasPorMes || []
    };

    console.log("✅ Respuesta:", response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json(
      { error: "Error obteniendo reportes" },
      { status: 500 }
    );
  }
}