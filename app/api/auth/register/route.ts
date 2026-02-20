import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { nombre, correo, password, rol, sucursal_id } = await req.json();

    if (!nombre || !correo || !password || !rol) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // validar que el correo no exista
    const [existing]: any = await db.query(
      "SELECT id FROM usuarios WHERE correo = ?",
      [correo]
    );

    if (existing.length > 0) {
      return NextResponse.json({ error: "Correo ya registrado" }, { status: 400 });
    }

    // encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // insertar en DB
    await db.query(
      "INSERT INTO usuarios (nombre, correo, password, rol, sucursal_id) VALUES (?, ?, ?, ?, ?)",
      [nombre, correo, hashedPassword, rol, sucursal_id || null]
    );

    return NextResponse.json({ message: "Usuario registrado" }, { status: 201 });
  } catch (error: any) {
    console.error("ERROR register:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
