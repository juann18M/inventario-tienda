import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const connection = await db.getConnection();

  try {
    const [apartadosRows]: any = await connection.execute(
      `SELECT a.id, a.cliente, a.total_apartado AS total, a.fecha, a.estado, 
              a.sucursal_id, s.nombre as sucursal_nombre, a.anticipo, a.observaciones,
              a.venta_id
       FROM apartados a
       LEFT JOIN sucursales s ON s.id = a.sucursal_id
       ORDER BY a.fecha DESC`
    );

    const apartados = [];

    for (const row of apartadosRows) {
      const [productosRows]: any = await connection.execute(
        `SELECT 
          da.producto_id,
          p.nombre,
          da.entrada as cantidad,
          da.precio_unitario as precio
         FROM detalle_apartado da
         JOIN productos p ON p.id = da.producto_id
         WHERE da.apartado_id = ?`,
        [row.id]
      );

      const [abonosRows]: any = await connection.execute(
        `SELECT monto, fecha 
         FROM abonos 
         WHERE apartado_id = ? 
         ORDER BY fecha DESC`,
        [row.id]
      );

      apartados.push({
        id: row.id,
        cliente: row.cliente,
        total: row.total,
        anticipo: row.anticipo || 0,
        fecha: row.fecha,
        estado: row.estado,
        sucursal_id: row.sucursal_id,
        sucursal_nombre: row.sucursal_nombre,
        observaciones: row.observaciones,
        venta_id: row.venta_id,
        productos: productosRows.map((p: any) => ({
          producto_id: p.producto_id,
          nombre: p.nombre,
          cantidad: p.cantidad,
          precio: p.precio
        })),
        abonos: abonosRows
      });
    }

    return NextResponse.json(apartados);
  } catch (error) {
    console.error("Error al obtener apartados:", error);
    return NextResponse.json({ error: "Error al cargar apartados" }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function POST(req: Request) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Obtener sesión del usuario
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuarioId = (session.user as any).id;
    if (!usuarioId) {
      return NextResponse.json({ error: "ID de usuario no encontrado" }, { status: 400 });
    }
    
    const { cliente, productos, sucursal_id, anticipo = 0, observaciones = "" } = await req.json();
    
    // Validar
    if (!sucursal_id) {
      return NextResponse.json({ error: "Sucursal no especificada" }, { status: 400 });
    }
    if (!cliente?.trim()) {
      return NextResponse.json({ error: "Cliente requerido" }, { status: 400 });
    }
    if (!productos?.length) {
      return NextResponse.json({ error: "Agrega al menos un producto" }, { status: 400 });
    }

    // Obtener nombre de la sucursal
    const [sucursalRows]: any = await connection.execute(
      `SELECT nombre FROM sucursales WHERE id = ?`,
      [sucursal_id]
    );
    
    if (sucursalRows.length === 0) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }
    
    const nombreSucursal = sucursalRows[0].nombre;
    
    // Calcular total
    let total = 0;
    for (const prod of productos) {
      total += prod.precio * prod.cantidad;
    }

    // Validar que el anticipo no sea mayor al total
    if (anticipo > total) {
      return NextResponse.json({ error: "El anticipo no puede ser mayor al total" }, { status: 400 });
    }
    
    // 🔴 CORREGIDO: Sin columna 'entrada' (ya que fue eliminada)
    const [result]: any = await connection.execute(
      `INSERT INTO apartados 
        (cliente, total_apartado, anticipo, fecha, estado, sucursal_id, usuario_id, observaciones) 
       VALUES (?, ?, ?, NOW(), 'pendiente', ?, ?, ?)`,
      [cliente, total, anticipo, sucursal_id, usuarioId, observaciones || null]
    );
    
    const apartadoId = result.insertId;
    
    // Insertar detalles y restar stock
    for (const prod of productos) {
      // Verificar stock disponible
      const [stockRows]: any = await connection.execute(
        `SELECT stock FROM productos WHERE id = ? AND sucursal = ?`,
        [prod.producto_id, nombreSucursal]
      );
      
      if (stockRows.length === 0) {
        await connection.rollback();
        return NextResponse.json({ 
          error: `Producto no encontrado en esta sucursal` 
        }, { status: 400 });
      }
      
      if (stockRows[0].stock < prod.cantidad) {
        await connection.rollback();
        return NextResponse.json({ 
          error: `Stock insuficiente para ${prod.nombre}. Disponible: ${stockRows[0].stock}` 
        }, { status: 400 });
      }
      
      // Insertar detalle
      await connection.execute(
        `INSERT INTO detalle_apartado 
          (apartado_id, producto_id, entrada, precio_unitario) 
         VALUES (?, ?, ?, ?)`,
        [apartadoId, prod.producto_id, prod.cantidad, prod.precio]
      );
      
      // RESTAR STOCK del producto en esa sucursal
      await connection.execute(
        `UPDATE productos SET stock = stock - ? WHERE id = ? AND sucursal = ?`,
        [prod.cantidad, prod.producto_id, nombreSucursal]
      );
    }

    // 🔴 NUEVO: Si hay anticipo, registrarlo como abono
    if (anticipo > 0) {
      await connection.execute(
        `INSERT INTO abonos (apartado_id, monto, fecha, usuario_id, sucursal_id) 
         VALUES (?, ?, NOW(), ?, ?)`,
        [apartadoId, anticipo, usuarioId, sucursal_id]
      );
    }
    
    await connection.commit();
    return NextResponse.json({ 
      message: "Apartado creado exitosamente", 
      id: apartadoId 
    }, { status: 201 });
    
  } catch (error) {
    await connection.rollback();
    console.error("Error al crear apartado:", error);
    return NextResponse.json({ error: "Error al crear apartado" }, { status: 500 });
  } finally {
    connection.release();
  }
}