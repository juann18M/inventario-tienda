import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var mysqlPool: mysql.Pool | undefined;
}

export const db =
  global.mysqlPool ??
  mysql.createPool({
    host: "localhost",
    user: "root",
    password: "2026",
    database: "inventario_tienda",
    waitForConnections: true,
    connectionLimit: 5, // 👈 BAJO en dev
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== "production") {
  global.mysqlPool = db;
}
