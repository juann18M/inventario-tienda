export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [sucursales] = await db.query(`
      SELECT 
        s.id,
        s.nombre
      FROM sucursales s
    `);

    return NextResponse.json(sucursales);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}