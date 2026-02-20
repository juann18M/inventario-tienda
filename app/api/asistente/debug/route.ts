import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  console.log("🔹 INICIO - API DEBUG");
  
  try {
    const session = await getServerSession(authOptions);
    console.log("🔹 Session:", session ? "OK" : "NO HAY SESSION");

    if (!session?.user) {
      console.log("❌ No autorizado");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const { mensaje } = await req.json();
    
    console.log(`👤 Usuario: ${user.id} - ${user.nombre}`);
    console.log(`💬 Mensaje: ${mensaje}`);
    console.log(`🏢 Sucursal: ${user.sucursal}`);

    // Respuesta temporal sin DB
    return NextResponse.json({
      success: true,
      respuesta: `Recibí: "${mensaje}". (Modo debug - sin DB)`,
      fecha: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("❌ ERROR EN DEBUG:");
    console.error("❌", error);
    return NextResponse.json(
      { error: "Error en debug", details: error.message },
      { status: 500 }
    );
  }
}