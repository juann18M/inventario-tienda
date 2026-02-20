// app/api/dashboard/apartados/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const rol = String((session.user as any)?.role || "").toLowerCase();
    const sucursal_id = (session.user as any)?.sucursal_id; // asumimos que tienes este campo en tu token

    let query = `
      SELECT 
        a.id,
        a.variante_id,
        a.sucursal_id,
        a.cliente,
        a.usuario_id,
        a.entrada,
        a.anticipo,
        a.total_apartado,
        a.estado,
        a.fecha,
        a.fecha_vencimiento,
        a.observaciones,
        u.nombre AS empleado,
        s.nombre AS sucursal
      FROM apartados a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      LEFT JOIN sucursales s ON a.sucursal_id = s.id
    `;

    // Si es empleado, solo trae apartados de su sucursal
    if (rol === "empleado") {
      query += ` WHERE a.sucursal_id = ?`;
      const [rows] = await db.query(query, [sucursal_id]);
      return NextResponse.json({ data: rows });
    }

    // Si es admin, trae todo
    const [rows] = await db.query(query);
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
