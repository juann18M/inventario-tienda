import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var mysqlPool: mysql.Pool | undefined;
}

// Configuración mejorada para soportar tanto URL de la nube como objeto local
export const db =
  global.mysqlPool ??
  (process.env.DATABASE_URL
    ? mysql.createPool(process.env.DATABASE_URL)
    : mysql.createPool({
        host: "localhost",
        user: "root",
        password: "2026",
        database: "inventario_tienda",
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
      }));

if (process.env.NODE_ENV !== "production") {
  global.mysqlPool = db;
}