import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var mysqlPool: mysql.Pool | undefined;
}

export const db =
  global.mysqlPool ??
  (process.env.DATABASE_URL
    ? mysql.createPool({
        uri: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: true,
        },
        waitForConnections: true,
        connectionLimit: 5,
      })
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