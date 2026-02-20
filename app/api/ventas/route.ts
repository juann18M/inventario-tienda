import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { crearVenta } from "@/lib/ventas";

export async function POST(req: NextRequest) {
  try {
    console.log("📨 [API VENTAS] Nueva solicitud recibida");
    
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.error("❌ [API VENTAS] No hay sesión activa");
      return NextResponse.json(
        { error: "Sesión expirada. Por favor, inicia sesión nuevamente." },
        { status: 401 }
      );
    }

    const user = session.user as any;
    const usuarioId = Number(user.id);
    
    console.log("👤 [API VENTAS] Usuario autenticado:", {
      id: usuarioId,
      email: user.email,
      name: user.name
    });

    const body = await req.json();
    console.log("📦 [API VENTAS] Datos recibidos:", body);

    const {
      productos,
      metodo_pago,
      sucursal_id,
      cliente,
      observaciones,
    } = body;

    // Validaciones básicas
    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return NextResponse.json(
        { error: "El carrito está vacío. Agrega productos para continuar." },
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

    // Validar cada producto
    const productosValidados = [];
    for (const p of productos) {
      if (!p.varianteId || p.varianteId <= 0) {
        return NextResponse.json(
          { error: "Uno o más productos tienen un ID inválido." },
          { status: 400 }
        );
      }
      if (!p.cantidad || p.cantidad <= 0) {
        return NextResponse.json(
          { error: `La cantidad para el producto ${p.varianteId} debe ser mayor a 0.` },
          { status: 400 }
        );
      }
      
      productosValidados.push({
        varianteId: Number(p.varianteId),
        cantidad: Number(p.cantidad)
      });
    }

    console.log("🔄 [API VENTAS] Creando venta con datos validados:", {
      usuarioId,
      sucursalId: sucursal_id,
      metodoPago: metodo_pago,
      productosCount: productosValidados.length
    });

    // Crear la venta
    const ventaId = await crearVenta({
      usuarioId: usuarioId,
      sucursalId: Number(sucursal_id),
      metodoPago: metodo_pago,
      cliente: cliente || null,
      observaciones: observaciones || null,
      productos: productosValidados,
    });

    console.log(`✅ [API VENTAS] Venta creada exitosamente: #${ventaId}`);

    return NextResponse.json({ 
      success: true, 
      ventaId: ventaId,
      message: "Venta registrada correctamente"
    });

  } catch (error: any) {
    console.error("❌ [API VENTAS] Error completo:", {
      message: error.message,
      code: (error as any).code
    });

    // Mensajes de error más amigables
    let errorMessage = "Ocurrió un error al procesar la venta. Por favor, intenta nuevamente.";
    
    if (error.message.includes("Stock insuficiente")) {
      errorMessage = error.message;
    } else if (error.message.includes("no encontrado")) {
      errorMessage = "Uno de los productos no está disponible en el inventario.";
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      errorMessage = "Error en la base de datos. Contacta al administrador.";
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}