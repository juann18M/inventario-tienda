import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { crearVenta } from "@/lib/ventas";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    console.log("📨 [API VENTAS] Nueva solicitud recibida");

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Sesión expirada. Por favor, inicia sesión nuevamente." },
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

    // ============================
    // VALIDACIONES
    // ============================

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return NextResponse.json(
        { error: "El carrito está vacío." },
        { status: 400 }
      );
    }

    if (!sucursal_id) {
      return NextResponse.json(
        { error: "Debe seleccionar una sucursal." },
        { status: 400 }
      );
    }

    if (!metodo_pago) {
      return NextResponse.json(
        { error: "Debe seleccionar un método de pago." },
        { status: 400 }
      );
    }

    // ============================
    // VALIDAR CAJA ABIERTA (del día actual)
    // ============================

    const [cajaActiva]: any = await db.query(
      `
      SELECT id, monto_inicial, monto_final, total_ventas 
      FROM cajas
      WHERE sucursal_id = ?
      AND estado = 'ABIERTA'
      AND fecha = CURDATE()
      LIMIT 1
      `,
      [Number(sucursal_id)]
    );

    if (!cajaActiva.length) {
      return NextResponse.json(
        { error: "No hay una caja abierta hoy en esta sucursal. Debes abrir caja antes de vender." },
        { status: 400 }
      );
    }

    const cajaId = cajaActiva[0].id;

    // ============================
    // VALIDAR PRODUCTOS
    // ============================

    const productosValidados = [];

    for (const p of productos) {
      if (!p.varianteId || p.varianteId <= 0) {
        return NextResponse.json(
          { error: "Uno o más productos tienen ID inválido." },
          { status: 400 }
        );
      }

      if (!p.cantidad || p.cantidad <= 0) {
        return NextResponse.json(
          { error: `Cantidad inválida para producto ${p.varianteId}.` },
          { status: 400 }
        );
      }

      productosValidados.push({
        varianteId: Number(p.varianteId),
        cantidad: Number(p.cantidad),
      });
    }

    // ============================
    // CREAR VENTA
    // ============================

    const ventaId = await crearVenta({
      usuarioId: usuarioId,
      sucursalId: Number(sucursal_id),
      metodoPago: metodo_pago,
      cliente: cliente || null,
      observaciones: observaciones || null,
      productos: productosValidados,
    });

    // ============================
    // OBTENER TOTAL DE LA VENTA
    // ============================

    const [ventaRows]: any = await db.query(
      "SELECT total FROM ventas WHERE id = ?",
      [ventaId]
    );

    if (!ventaRows.length) {
      throw new Error("Venta creada pero no encontrada");
    }

    const totalVenta = Number(ventaRows[0].total);

    // ============================
    // SUMAR A CAJA (actualizar montos)
    // ============================

    await db.query(
      `
      UPDATE cajas
      SET total_ventas = total_ventas + ?,
          monto_final = monto_inicial + (total_ventas + ?)
      WHERE id = ?
      `,
      [totalVenta, totalVenta, cajaId]
    );

    console.log(`✅ Venta #${ventaId} registrada. Total: $${totalVenta} sumado a caja ${cajaId}`);

    return NextResponse.json({
      success: true,
      ventaId: ventaId,
      message: "Venta registrada correctamente",
      total: totalVenta
    });

  } catch (error: any) {
    console.error("❌ Error en ventas:", error);

    let errorMessage =
      "Ocurrió un error al procesar la venta.";

    if (error.message?.includes("Stock insuficiente")) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}