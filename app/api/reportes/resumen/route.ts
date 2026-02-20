import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    console.log("🔵 Iniciando consulta de reportes...");

    // 🔹 Ventas totales (acumuladas)
    const [ventas] = await db.query(`
      SELECT 
        COUNT(*) as total_ventas,
        COALESCE(SUM(total), 0) as monto_total
      FROM ventas
      WHERE total > 0
    `);

    // 🔹 Productos vendidos (acumulados)
    const [productos] = await db.query(`
      SELECT 
        COALESCE(SUM(cantidad), 0) as productos_vendidos
      FROM detalle_venta
    `);

    // 🔹 Ventas por día (últimos 7 días)
    const [ventasPorDia] = await db.query(`
      SELECT 
        DATE(fecha) as dia,
        COUNT(*) as cantidad_ventas,
        COALESCE(SUM(total), 0) as total
      FROM ventas
      WHERE total > 0 
        AND fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(fecha)
      ORDER BY dia ASC
    `);

    // 🔹 Ventas por método de pago
    const [ventasPorMetodo] = await db.query(`
      SELECT 
        metodo_pago,
        COUNT(*) as cantidad,
        COALESCE(SUM(total), 0) as total
      FROM ventas
      WHERE total > 0
      GROUP BY metodo_pago
    `);

    // 🔹 Top 5 productos más vendidos
    const [topProductos] = await db.query(`
      SELECT 
        p.nombre,
        SUM(dv.cantidad) as total_vendido,
        SUM(dv.precio * dv.cantidad) as total_generado
      FROM detalle_venta dv
      JOIN productos p ON p.id = dv.variante_id
      GROUP BY p.id, p.nombre
      ORDER BY total_vendido DESC
      LIMIT 5
    `);

    // 🔹 Empleado top (acumulado)
    const [empleado] = await db.query(`
      SELECT 
        u.nombre, 
        COALESCE(SUM(v.total), 0) as total,
        COUNT(*) as ventas_realizadas
      FROM ventas v
      JOIN usuarios u ON u.id = v.usuario_id
      WHERE v.total > 0
      GROUP BY u.id, u.nombre
      ORDER BY total DESC
      LIMIT 1
    `);

    // 🔹 Sucursal top (acumulado)
    const [sucursal] = await db.query(`
      SELECT 
        s.nombre, 
        COALESCE(SUM(v.total), 0) as total,
        COUNT(*) as ventas_realizadas
      FROM ventas v
      JOIN sucursales s ON s.id = v.sucursal_id
      WHERE v.total > 0
      GROUP BY s.id, s.nombre
      ORDER BY total DESC
      LIMIT 1
    `);

    // 🔹 Totales acumulados por mes
    const [ventasPorMes] = await db.query(`
      SELECT 
        DATE_FORMAT(fecha, '%Y-%m') as mes,
        COUNT(*) as cantidad_ventas,
        COALESCE(SUM(total), 0) as total
      FROM ventas
      WHERE total > 0
      GROUP BY DATE_FORMAT(fecha, '%Y-%m')
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