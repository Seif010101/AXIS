import "server-only";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "@/env";
import * as schema from "./schema";

export type Database = MySql2Database<typeof schema>;

// One pool per server process. In dev, hot reload re-evaluates this module, so the pool
// is kept on globalThis to avoid exhausting the database's connection limit.
const globalForDb = globalThis as unknown as { __dbPool?: mysql.Pool };

const pool =
  globalForDb.__dbPool ??
  mysql.createPool({
    uri: env.DATABASE_URL,
    connectionLimit: env.DATABASE_POOL_SIZE,
    timezone: "Z", // all DATETIME values are UTC
    charset: "utf8mb4",
    // Raw numeric aggregates (SUM/AVG) come back as numbers. Drizzle still maps DECIMAL
    // columns to strings, matching their TypeScript type.
    decimalNumbers: true,
  });

if (!globalForDb.__dbPool) {
  // `timezone: "Z"` only affects how the driver converts dates; the server's own clock
  // functions (CURRENT_TIMESTAMP, NOW) follow the session time zone, so pin it to UTC.
  pool.on("connection", (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });
}

if (env.NODE_ENV !== "production") globalForDb.__dbPool = pool;

// mode "planetscale": relational queries without LATERAL joins, which MariaDB lacks.
export const db: Database = drizzle(pool, { schema, mode: "planetscale" });

export { schema };

/** For scripts and tests: lets the process exit. */
export const closeDb = () => pool.end();
