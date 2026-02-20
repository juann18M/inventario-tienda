import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sucursalNombre = searchParams.get("sucursal");

    if (!sucursalNombre) {
      return NextResponse.json({ error: "Sucursal no especificada" }, { status: 400 });
    }

    // Obtener ID de la sucursal
    const [suc]: any = await db.query(
      "SELECT id FROM sucursales WHERE nombre = ?", 
      [sucursalNombre]
    );
    
    if (suc.length === 0) {
      return NextResponse.json({ 
        success: true, 
        totalVentas: 0, 
        cantidadVentas: 0,
        apartadosActivos: 0,
        apartadosPendientes: 0,
        stockBajo: 0,
        ultimaVenta: null,
        ventasSemana: [0,0,0,0,0,0,0],
        productosLentos: [],
        clientesPendientes: [],
        productoTopHoy: null
      });
    }
    
    const sID = suc[0].id;

    // ========== 1. VENTAS DE HOY ==========
    const [ventas]: any = await db.query(
      `SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad
       FROM ventas 
       WHERE sucursal_id = ? AND DATE(fecha) = CURDATE() AND total > 0`,
      [sID]
    );

    // ========== 2. VENTAS DE LA SEMANA (últimos 7 días) ==========
    const [ventasSemanaRaw]: any = await db.query(
      `SELECT 
        DAYOFWEEK(fecha) as dia_semana,
        COALESCE(SUM(total), 0) as total
       FROM ventas 
       WHERE sucursal_id = ? 
         AND fecha >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         AND total > 0
       GROUP BY DAYOFWEEK(fecha)
       ORDER BY dia_semana`,
      [sID]
    );

    // Crear array de 7 días [Lun, Mar, Mié, Jue, Vie, Sáb, Dom]
    const ventasSemana = [0, 0, 0, 0, 0, 0, 0];
    
    // Mapear día de la semana (MySQL: 1=Dom, 2=Lun, 3=Mar, 4=Mié, 5=Jue, 6=Vie, 7=Sáb)
    ventasSemanaRaw.forEach((item: any) => {
      const diaMap: { [key: number]: number } = {
        2: 0, // Lun
        3: 1, // Mar
        4: 2, // Mié
        5: 3, // Jue
        6: 4, // Vie
        7: 5, // Sáb
        1: 6  // Dom
      };
      const index = diaMap[item.dia_semana];
      if (index !== undefined) {
        ventasSemana[index] = Number(item.total);
      }
    });

    // ========== 3. APARTADOS ACTIVOS (pendientes) ==========
    const [apartadosActivos]: any = await db.query(
      `SELECT COUNT(*) as total
       FROM apartados 
       WHERE sucursal_id = ? AND estado = 'pendiente'`,
      [sID]
    );

    // ========== 4. APARTADOS PENDIENTES PARA HOY ==========
    const [apartadosPendientesHoy]: any = await db.query(
      `SELECT COUNT(*) as total
       FROM apartados 
       WHERE sucursal_id = ? AND estado = 'pendiente' AND DATE(fecha) = CURDATE()`,
      [sID]
    );

    // ========== 5. STOCK BAJO (menos de 3 unidades) ==========
    const [stockBajo]: any = await db.query(
      `SELECT COUNT(*) as total
       FROM inventario_sucursal 
       WHERE sucursal = ? AND stock < 3 AND stock > 0`,
      [sucursalNombre]
    );

    // ========== 6. ÚLTIMA VENTA ==========
    const [ultimaVenta]: any = await db.query(
      `SELECT id, total as monto, cliente, fecha
       FROM ventas 
       WHERE sucursal_id = ? AND total > 0 
       ORDER BY fecha DESC 
       LIMIT 1`,
      [sID]
    );

    // ========== 7. PRODUCTOS LENTOS (sin ventas en últimos 20 días) ==========
    const [productosLentos]: any = await db.query(
      `SELECT 
        p.nombre,
        p.id,
        COALESCE(is2.stock, 0) as stock,
        COALESCE(DATEDIFF(CURDATE(), MAX(v.fecha)), 99) as diasSinVender
       FROM productos p
       LEFT JOIN inventario_sucursal is2 ON is2.producto_id = p.id AND is2.sucursal = ?
       LEFT JOIN detalle_venta dv ON dv.variante_id = p.id
       LEFT JOIN ventas v ON v.id = dv.venta_id AND v.sucursal_id = ?
       WHERE is2.stock > 0
       GROUP BY p.id, p.nombre, is2.stock
       HAVING diasSinVender > 20 OR diasSinVender IS NULL
       ORDER BY diasSinVender DESC
       LIMIT 3`,
      [sucursalNombre, sID]
    );

    // ========== 8. CLIENTES CON APARTADOS PENDIENTES HOY ==========
    const [clientesPendientes]: any = await db.query(
      `SELECT 
        a.cliente,
        a.id,
        a.total_apartado - COALESCE(a.anticipo, 0) as saldo,
        a.fecha
       FROM apartados a
       WHERE a.sucursal_id = ? 
         AND a.estado = 'pendiente'
         AND DATE(a.fecha) = CURDATE()
       ORDER BY a.fecha ASC
       LIMIT 3`,
      [sID]
    );

    // ========== 9. PRODUCTO MÁS VENDIDO HOY ==========
    const [productoTopHoy]: any = await db.query(
      `SELECT 
        p.nombre,
        SUM(dv.cantidad) as cantidad
       FROM detalle_venta dv
       JOIN productos p ON p.id = dv.variante_id
       JOIN ventas v ON v.id = dv.venta_id
       WHERE v.sucursal_id = ? AND DATE(v.fecha) = CURDATE()
       GROUP BY p.id, p.nombre
       ORDER BY cantidad DESC
       LIMIT 1`,
      [sID]
    );

    return NextResponse.json({
      success: true,
      totalVentas: ventas[0]?.total || 0,
      cantidadVentas: ventas[0]?.cantidad || 0,
      apartadosActivos: apartadosActivos[0]?.total || 0,
      apartadosPendientes: apartadosPendientesHoy[0]?.total || 0,
      stockBajo: stockBajo[0]?.total || 0,
      ultimaVenta: ultimaVenta[0] || null,
      ventasSemana: ventasSemana,
      productosLentos: productosLentos || [],
      clientesPendientes: clientesPendientes || [],
      productoTopHoy: productoTopHoy[0] || null
    });

  } catch (error: any) {
    console.error("Error en dashboard stats:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}