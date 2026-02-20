import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const [sucursales] = await db.query(`
    SELECT 
      s.id,
      s.nombre
    FROM sucursales s
  `);

  return NextResponse.json(sucursales);
}
