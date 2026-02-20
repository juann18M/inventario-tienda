import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const [usuarios] = await db.query(`
      SELECT 
        u.id,
        u.nombre,
        u.correo,
        u.rol,
        s.nombre as sucursal_nombre
      FROM usuarios u
      LEFT JOIN sucursales s ON u.sucursal_id = s.id
      WHERE u.rol != 'admin'
      ORDER BY u.nombre ASC
    `);

    return NextResponse.json(usuarios);
  } catch (error: any) {
    console.error("Error obteniendo usuarios:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}