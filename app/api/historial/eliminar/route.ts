import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ 
        success: false,
        error: "No autorizado" 
      }, { status: 401 });
    }

    const user = session.user as any;
    const rol = user.role.toLowerCase();
    const { searchParams } = new URL(request.url);
    const ventaId = searchParams.get("id");
    
    console.log("🔧 Eliminar venta - Parámetros:", {
      ventaId,
      usuario: user.name,
      rol
    });

    // Solo admin puede eliminar
    if (rol !== "admin") {
      return NextResponse.json({
        success: false,
        error: "Solo administradores pueden eliminar ventas" 
      }, { status: 403 });
    }

    // Validar ID
    if (!ventaId) {
      return NextResponse.json({
        success: false,
        error: "ID de venta requerido" 
      }, { status: 400 });
    }

    const id = parseInt(ventaId);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json({
        success: false,
        error: "ID de venta inválido" 
      }, { status: 400 });
    }

    // Verificar que la venta existe
    const [ventaCheck]: any = await db.execute(
      "SELECT id, fecha, total FROM ventas WHERE id = ?",
      [id]
    );

    if (ventaCheck.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Venta no encontrada" 
      }, { status: 404 });
    }

    const venta = ventaCheck[0];
    console.log("📊 Venta a eliminar:", venta);

   // Iniciar transacción
await db.query("START TRANSACTION");

try {
  const [detalleResult]: any = await db.execute(
    "DELETE FROM detalle_venta WHERE venta_id = ?",
    [id]
  );

  const [ventaResult]: any = await db.execute(
  `
  UPDATE ventas
  SET visible_dashboard = 0
  WHERE id = ?
  `,
  [id]
);


  await db.query("COMMIT");

  return NextResponse.json({
    success: true,
    message: `Venta #${id} eliminada exitosamente`
  });

} catch (error) {
  await db.query("ROLLBACK");
  throw error;
}


  } catch (error: any) {
    console.error("❌ Error eliminando venta:", {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState
    });
    
    return NextResponse.json({
      success: false,
      error: "Error al eliminar la venta",
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}