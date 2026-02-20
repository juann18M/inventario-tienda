import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";


// ======================== GET - LISTAR TRASLADOS ========================
// ======================== GET - LISTAR TRASLADOS ========================
export async function GET() {
  const connection = await db.getConnection();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const userRole = user.role?.toLowerCase();

    let query = `
      SELECT 
        t.id,
        t.fecha,
        t.estado,
        t.observacion,
        so.nombre AS sucursal_origen,
        sd.nombre AS sucursal_destino,
        u.nombre AS usuario_nombre,
        COUNT(DISTINCT td.id) AS total_productos,
        COALESCE(SUM(td.cantidad), 0) AS total_cantidad
      FROM traslados t
      LEFT JOIN sucursales so ON so.id = t.sucursal_origen
      LEFT JOIN sucursales sd ON sd.id = t.sucursal_destino
      LEFT JOIN usuarios u ON u.id = t.usuario_id
      LEFT JOIN traslado_detalles td ON td.traslado_id = t.id
    `;

    let params: any[] = [];

    // 🔐 Si NO es admin → filtrar por su sucursal
    if (userRole !== "admin") {
  const [sucursalRows]: any = await connection.execute(
    `SELECT id FROM sucursales WHERE nombre = ?`,
    [user.sucursal]
  );

  if (!sucursalRows.length) {
    return NextResponse.json({ success: true, traslados: [] });
  }

  const userSucursalId = sucursalRows[0].id;

  query += `
    WHERE (t.sucursal_origen = ? OR t.sucursal_destino = ?)
    AND t.estado = 'completado'
  `;

  params.push(userSucursalId, userSucursalId);

} else {
  // Admin también filtra cancelados
  query += `
    WHERE t.estado = 'completado'
  `;
}
query += `
  GROUP BY t.id
  ORDER BY t.fecha DESC
`;

const [rows]: any = await connection.execute(query, params);

return NextResponse.json({
  success: true,
  traslados: rows
});

} catch (error) {
  console.error("❌ Error al listar traslados:", error);
  return NextResponse.json(
    { error: "Error al obtener traslados" },
    { status: 500 }
  );
} finally {
  connection.release();
}
}

  

// ======================== POST - REGISTRAR TRASLADO ========================
export async function POST(req: Request) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { origen, destino, productos, observacion } = body;

    if (!origen || !destino || !productos?.length) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios" },
        { status: 400 }
      );
    }

    if (origen === destino) {
      return NextResponse.json(
        { error: "Origen y destino deben ser diferentes" },
        { status: 400 }
      );
    }

    const userRole = user.role?.toLowerCase();

    // 🔐 Validar permisos
    if (userRole !== "admin" && user.sucursal !== origen) {
      return NextResponse.json(
        { error: "No tienes permiso para trasladar desde esta sucursal" },
        { status: 403 }
      );
    }

    // 🔹 Obtener ID sucursal origen
    const [origenRows]: any = await connection.execute(
      `SELECT id FROM sucursales WHERE nombre = ?`,
      [origen]
    );

    if (!origenRows.length) {
      throw new Error("Sucursal origen no encontrada");
    }

    const origenId = origenRows[0].id;

    // 🔹 Obtener ID sucursal destino
    const [destinoRowsSucursal]: any = await connection.execute(
      `SELECT id FROM sucursales WHERE nombre = ?`,
      [destino]
    );

    if (!destinoRowsSucursal.length) {
      throw new Error("Sucursal destino no encontrada");
    }

    const destinoId = destinoRowsSucursal[0].id;

    // 🔹 Validar stock
    for (const item of productos) {
      const [rows]: any = await connection.execute(
        `SELECT stock FROM productos 
         WHERE id = ? AND sucursal = ?`,
        [item.producto_id, origen]
      );

      if (!rows.length) {
        throw new Error(
          `El producto ID ${item.producto_id} no existe en ${origen}`
        );
      }

      if (Number(rows[0].stock) < item.cantidad) {
        throw new Error(
          `Stock insuficiente para producto ID ${item.producto_id}`
        );
      }
    }

    // 🔹 Insertar traslado
    const [trasladoResult]: any = await connection.execute(
      `INSERT INTO traslados 
       (sucursal_origen, sucursal_destino, usuario_id, fecha, estado, observacion) 
       VALUES (?, ?, ?, NOW(), 'completado', ?)`,
      [origenId, destinoId, user.id, observacion || null]
    );

    const trasladoId = trasladoResult.insertId;

    // 🔹 Procesar productos
    for (const item of productos) {
      const { producto_id, cantidad } = item;

      const [productoRows]: any = await connection.execute(
        `SELECT * FROM productos 
         WHERE id = ? AND sucursal = ?`,
        [producto_id, origen]
      );

      const productoOrigen = productoRows[0];

      // Insertar detalle
      await connection.execute(
        `INSERT INTO traslado_detalles 
         (traslado_id, id_producto, cantidad) 
         VALUES (?, ?, ?)`,
        [trasladoId, producto_id, cantidad]
      );

      // Restar stock origen
      await connection.execute(
        `UPDATE productos 
         SET stock = stock - ? 
         WHERE id = ? AND sucursal = ?`,
        [cantidad, producto_id, origen]
      );

      // Verificar si existe en destino por SKU
      const [destinoProductoRows]: any = await connection.execute(
        `SELECT id FROM productos 
         WHERE sku = ? AND sucursal = ?`,
        [productoOrigen.sku, destino]
      );

      if (destinoProductoRows.length) {
        await connection.execute(
          `UPDATE productos 
           SET stock = stock + ? 
           WHERE sku = ? AND sucursal = ?`,
          [cantidad, productoOrigen.sku, destino]
        );
      } else {
        await connection.execute(
          `INSERT INTO productos
          (nombre, sku, categoria, stock, precio, descripcion, talla, color, imagen, sucursal, activo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            productoOrigen.nombre,
            productoOrigen.sku,
            productoOrigen.categoria,
            cantidad,
            productoOrigen.precio,
            productoOrigen.descripcion,
            productoOrigen.talla,
            productoOrigen.color,
            productoOrigen.imagen,
            destino
          ]
        );
      }
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: "Traslado registrado correctamente",
      trasladoId
    });

  } catch (error: any) {
    await connection.rollback();
    console.error("❌ Error traslado:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar traslado" },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
