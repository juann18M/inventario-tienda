import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { crearVenta } from "@/lib/ventas";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Sesión expirada." },
        { status: 401 }
      );
    }

    const user = session.user as any;
    const usuarioId = Number(user.id);

    const body = await req.json();
    const {
      productos,
      metodo_pago,
      sucursal_id,
      cliente,
      observaciones,
    } = body;

    /* ============================
       VALIDAR CAJA ABIERTA
    ============================ */

    const [cajaActiva]: any = await db.query(
      `
      SELECT id
      FROM cajas
      WHERE sucursal_id = ?
      AND estado = 'ABIERTA'
      ORDER BY id DESC
      LIMIT 1
      `,
      [Number(sucursal_id)]
    );

    if (!cajaActiva.length) {
      return NextResponse.json(
        { error: "No hay caja abierta." },
        { status: 400 }
      );
    }

    const cajaId = cajaActiva[0].id;

    /* ============================
       CREAR VENTA (usa su propia transacción)
    ============================ */

    const ventaId = await crearVenta({
      usuarioId,
      sucursalId: Number(sucursal_id),
      metodoPago: metodo_pago,
      cliente: cliente || null,
      observaciones: observaciones || null,
      productos,
    });

    /* ============================
       OBTENER TOTAL
    ============================ */

    const [ventaRows]: any = await db.query(
      "SELECT total FROM ventas WHERE id = ?",
      [ventaId]
    );

    const totalVenta = Number(ventaRows[0].total);

    /* ============================
       ACTUALIZAR CAJA
    ============================ */

    await db.query(
      `
      UPDATE cajas
      SET 
        total_ventas = total_ventas + ?,
        total_transacciones = total_transacciones + 1,
        monto_final = monto_final + ?
      WHERE id = ?
      `,
      [totalVenta, totalVenta, cajaId]
    );

    await db.query(
      `
      INSERT INTO movimientos_caja
      (caja_id, tipo, referencia_id, monto, descripcion, usuario_id)
      VALUES (?, 'VENTA', ?, ?, ?, ?)
      `,
      [
        cajaId,
        ventaId,
        totalVenta,
        `Venta #${ventaId}`,
        usuarioId
      ]
    );

    return NextResponse.json({
      success: true,
      ventaId,
      total: totalVenta,
    });

  } catch (error: any) {
    console.error("❌ Error en ventas:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar venta" },
      { status: 500 }
    );
  }
}