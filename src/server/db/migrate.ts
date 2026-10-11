import { existsSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

// Applies pending SQL migrations from ./drizzle when the server starts (called from
// src/instrumentation.ts). The hosting database is not reachable from outside, so the app
// migrates itself on each deploy. Uses its own connection instead of the app pool so it
// can run before anything else is initialised.
const LOCK_NAME = "app_schema_migrations";
const LOCK_TIMEOUT_SECONDS = 120;

// Source checkout (dev, tests) first, then the copy that `npm run build` puts inside `.next`
// (the deployed server has no source tree; see scripts/copy-migrations.mjs).
function findMigrationsFolder(): string {
  const candidates = [path.join(process.cwd(), "drizzle"), path.join(process.cwd(), ".next", "drizzle")];
  const found = candidates.find((dir) => existsSync(path.join(dir, "meta", "_journal.json")));
  if (!found) throw new Error(`no migrations found; looked in ${candidates.join(", ")}`);
  return found;
}

export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL is not set, skipping migrations");
    return;
  }

  const connection = await mysql.createConnection({ uri: url, timezone: "Z", charset: "utf8mb4" });
  try {
    await connection.query("SET time_zone = '+00:00'");
    // Several server processes may boot at once; only one may migrate at a time.
    const [rows] = await connection.query("SELECT GET_LOCK(?, ?) AS acquired", [
      LOCK_NAME,
      LOCK_TIMEOUT_SECONDS,
    ]);
    if ((rows as { acquired: number }[])[0]?.acquired !== 1) {
      throw new Error(`could not acquire the migration lock within ${LOCK_TIMEOUT_SECONDS}s`);
    }
    try {
      await migrate(drizzle(connection), { migrationsFolder: findMigrationsFolder() });
      console.log("[migrate] database schema is up to date");
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]);
    }
  } finally {
    await connection.end();
  }
}
