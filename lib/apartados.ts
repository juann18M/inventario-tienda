import { db } from "@/lib/db";

export interface Apartado {
  id: number;
  cliente: string;
  total: number;
  fecha: string;
  productos: { nombre: string; cantidad: number }[];
}

export async function getApartados(): Promise<Apartado[]> {
  const connection = await db.getConnection();

  try {
    // Trae los apartados
    const [apartadosRows]: any = await connection.execute(
      `SELECT id, cliente, total, fecha
       FROM apartados
       ORDER BY fecha DESC`
    );

    const apartados: Apartado[] = [];

    for (const row of apartadosRows) {
      // Trae los productos de cada apartado
      const [productosRows]: any = await connection.execute(
        `SELECT p.nombre, da.cantidad
         FROM detalle_apartado da
         JOIN productos p ON p.id = da.producto_id
         WHERE da.apartado_id = ?`,
        [row.id]
      );

      apartados.push({
        id: row.id,
        cliente: row.cliente,
        total: row.total,
        fecha: row.fecha,
        productos: productosRows.map((p: any) => ({
          nombre: p.nombre,
          cantidad: p.cantidad,
        })),
      });
    }

    return apartados;

  } finally {
    connection.release();
  }
}
