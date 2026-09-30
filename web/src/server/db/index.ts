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
    // DECIMAL columns (scores) come back as numbers instead of strings.
    decimalNumbers: true,
  });

if (env.NODE_ENV !== "production") globalForDb.__dbPool = pool;

// mode "planetscale": relational queries without LATERAL joins, which MariaDB lacks.
export const db: Database = drizzle(pool, { schema, mode: "planetscale" });

export { schema };

/** For scripts and tests: lets the process exit. */
export const closeDb = () => pool.end();
