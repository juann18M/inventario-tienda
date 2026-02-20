import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    // 1. Verificar autenticación
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      console.log("❌ [INVENTARIO] No autorizado - Sin sesión");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Obtener parámetros
    const { searchParams } = new URL(request.url);
    const sucursalQuery = searchParams.get("sucursal");
    const user = session.user as any;
    const rol = String(user?.role || "").toLowerCase();
    const sucursalUsuario = user?.sucursal;

    console.log("👤 [INVENTARIO] Usuario:", {
      id: user?.id,
      email: user?.email,
      rol,
      sucursalUsuario
    });

    // 3. Determinar sucursal
    let sucursalFinal: string;

    if (rol === "admin") {
      sucursalFinal = sucursalQuery || user?.sucursal || "Centro Isidro Huarte 1";
      console.log(`👑 [INVENTARIO] Admin usando sucursal: "${sucursalFinal}"`);
    } else {
      sucursalFinal = sucursalUsuario || "Centro Isidro Huarte 1";
      console.log(`👤 [INVENTARIO] Usuario usando su sucursal: "${sucursalFinal}"`);
    }

    // 4. Buscar sucursal exacta
    const [sucursalesExistentes]: any = await db.execute(
      `SELECT DISTINCT sucursal FROM productos WHERE sucursal LIKE ?`,
      [`%${sucursalFinal}%`]
    );

    console.log(`🏪 [INVENTARIO] Sucursales que coinciden con "${sucursalFinal}":`, 
      sucursalesExistentes.map((s: any) => s.sucursal));

    if (sucursalesExistentes.length === 0) {
      console.warn(`⚠️ [INVENTARIO] No se encontró la sucursal "${sucursalFinal}"`);
      return NextResponse.json([], { status: 200 });
    }

    const sucursalExacta = sucursalesExistentes[0].sucursal;
    console.log(`📍 [INVENTARIO] Usando sucursal exacta: "${sucursalExacta}"`);

    // ✅ 5. CONSULTA DIRECTA - SIN DEPENDER DE TABLA VARIANTES
    const query = `
  SELECT 
    p.id AS id,               -- ✅ ID REAL DEL PRODUCTO (ESTE ES EL QUE SE USA PARA ELIMINAR)
    p.id AS varianteId,       -- (si no usas variantes, puede quedarse igual)
    p.id AS productoId,
    p.nombre,
    COALESCE(p.sku, '') AS sku,
    COALESCE(p.categoria, '') AS categoria,
    COALESCE(p.descripcion, '') AS descripcion,
    COALESCE(p.talla, '') AS talla,
    COALESCE(p.color, '') AS color,
    COALESCE(p.imagen, '') AS imagen,
    p.stock,
    p.precio,
    p.sucursal
  FROM productos p
  WHERE p.sucursal = ?
    AND p.stock >= 0
  ORDER BY p.nombre
`;


    // 6. Ejecutar consulta
    console.log(`📋 [INVENTARIO] Ejecutando consulta para sucursal: ${sucursalExacta}`);
    const [rows]: any = await db.execute(query, [sucursalExacta]);

    console.log(`✅ [INVENTARIO] Productos obtenidos: ${rows.length}`);
    
    // 7. Verificar que varianteId está presente
    if (rows.length > 0) {
      console.log(`🔍 Primer producto:`, {
        varianteId: rows[0].varianteId,
        productoId: rows[0].productoId,
        nombre: rows[0].nombre,
        color: rows[0].color,
        stock: rows[0].stock
      });
    }

    return NextResponse.json(rows);

  } catch (error: any) {
    console.error("❌ [INVENTARIO] Error:", error.message);
    return NextResponse.json(
      { error: "Error al cargar el inventario" }, 
      { status: 500 }
    );
  }
}

// Mantén tu método POST para debugging igual
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;
    
    if (action === "test-connection") {
      const [result]: any = await db.execute("SELECT 1 as test");
      return NextResponse.json({ success: true, test: result[0].test });
    }
    
    if (action === "check-products") {
      const [productos]: any = await db.execute(
        "SELECT COUNT(*) as count FROM productos"
      );
      return NextResponse.json({ success: true, productos: productos[0] });
    }
    
    if (action === "check-fields") {
      const [columns]: any = await db.execute("SHOW COLUMNS FROM productos");
      const campos = columns.map((col: any) => col.Field);
      return NextResponse.json({
        success: true,
        campos,
        tieneColor: campos.includes('color'),
        tieneImagen: campos.includes('imagen')
      });
    }
    
    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}