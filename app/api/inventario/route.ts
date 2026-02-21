import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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
    const sucursalQuery = searchParams.get("sucursal");

    const user = session.user as any;
    const rol = String(user?.role || "").toLowerCase();
    const sucursalUsuario = user?.sucursal_nombre;

    let sucursalFinal: string;

    if (rol === "admin") {
      sucursalFinal =
        sucursalQuery || sucursalUsuario || "Centro Isidro Huarte 1";
    } else {
      sucursalFinal =
        sucursalUsuario || "Centro Isidro Huarte 1";
    }

    if (!sucursalFinal) {
      return NextResponse.json([], { status: 200 });
    }

    console.log("🔎 Sucursal recibida:", `"${sucursalFinal}"`);

    // 🔥 FILTRO ROBUSTO
    const query = `
      SELECT 
        p.id,
        p.id AS varianteId,
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
      WHERE LOWER(TRIM(p.sucursal)) = LOWER(TRIM(?))
        AND p.stock >= 0
      ORDER BY p.nombre ASC
    `;

    const [rows]: any = await db.execute(query, [
      sucursalFinal,
    ]);

    console.log("📦 Productos encontrados:", rows.length);

    return NextResponse.json(rows);

  } catch (error: any) {
    console.error("❌ Error inventario:", error);
    return NextResponse.json(
      { error: "Error al cargar inventario" },
      { status: 500 }
    );
  }
}