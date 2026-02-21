// app/api/reportes/limpiar/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    console.log("🔵 Iniciando limpieza de reportes...");
    
    // Obtener parámetros de la URL
    const { searchParams } = new URL(request.url);
    const sucursalId = searchParams.get('sucursal_id');

    console.log("🗑️ Limpiando reportes con filtro:", { sucursalId });

    // Construir filtros SQL
    let filtroVentas = "";
    let filtroDetalle = "";
    
    if (sucursalId && sucursalId !== 'todas') {
      filtroVentas = `WHERE sucursal_id = ${parseInt(sucursalId)}`;
      // Para detalle_venta necesitamos JOIN con ventas
      filtroDetalle = `WHERE venta_id IN (SELECT id FROM ventas WHERE sucursal_id = ${parseInt(sucursalId)})`;
    }

    // Iniciar transacción manual
    await db.query('START TRANSACTION');

    try {
      // 1. Eliminar detalles de venta (primero por foreign keys)
      if (filtroDetalle) {
        await db.query(`DELETE FROM detalle_venta ${filtroDetalle}`);
      } else {
        await db.query('DELETE FROM detalle_venta');
      }
      
      // 2. Eliminar ventas
      if (filtroVentas) {
        await db.query(`DELETE FROM ventas ${filtroVentas}`);
      } else {
        await db.query('DELETE FROM ventas');
      }
      
      // Confirmar transacción
      await db.query('COMMIT');
      
      console.log("✅ Reportes limpiados exitosamente");
      
      return NextResponse.json({
        success: true,
        message: sucursalId && sucursalId !== 'todas'
          ? `Reportes de la sucursal limpiados correctamente`
          : 'Todos los reportes han sido reiniciados'
      });
      
    } catch (error) {
      // Si hay error, revertir cambios
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error("❌ Error al limpiar reportes:", error);
    return NextResponse.json(
      { error: "Error al limpiar los reportes" },
      { status: 500 }
    );
  }
}