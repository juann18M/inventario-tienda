// app/api/dashboard/detalle_venta/route.ts
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
    const sucursal_id = (session.user as any)?.sucursal_id;

    // Consulta para traer detalle de venta con info de productos y venta
    let query = `
      SELECT 
        dv.id,
        dv.venta_id,
        dv.variante_id,
        p.nombre AS producto,
        dv.cantidad,
        dv.precio,
        v.sucursal_id,
        s.nombre AS sucursal,
        v.cliente,
        v.metodo_pago,
        v.observaciones,
        v.fecha
      FROM detalle_venta dv
      LEFT JOIN ventas v ON dv.venta_id = v.id
      LEFT JOIN variantes var ON dv.variante_id = var.id
      LEFT JOIN productos p ON var.producto_id = p.id
      LEFT JOIN sucursales s ON v.sucursal_id = s.id
    `;

    // Filtrar por sucursal si es empleado
    if (rol === "empleado") {
      query += " WHERE v.sucursal_id = ?";
      const [rows] = await db.query(query, [sucursal_id]);
      return NextResponse.json({ data: rows });
    }

    // Admin ve todo
    const [rows] = await db.query(query);
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
