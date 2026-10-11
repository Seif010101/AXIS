import mysql from "mysql2/promise";
import migrations from "./migrations.generated.json";

// Applies pending SQL migrations when the server starts (called from
// src/instrumentation.ts). The hosting database isn't reachable from outside, so the app
// migrates itself on each deploy.
//
// The migrations are bundled into the code (scripts/bundle-migrations.mjs) because the host
// deploys only parts of the build output, not the drizzle/ folder. Bookkeeping matches
// drizzle-kit exactly (same __drizzle_migrations table and rules), so `npm run db:migrate`
// and this runner can be used on the same database.
const LOCK_NAME = "app_schema_migrations";
const LOCK_TIMEOUT_SECONDS = 120;
const MIGRATIONS_TABLE = "__drizzle_migrations";

interface Migration {
  sql: string[];
  folderMillis: number;
  hash: string;
}

export async function runMigrations(): Promise<number | null> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL is not set, skipping migrations");
    return null;
  }

  const connection = await mysql.createConnection({ uri: url, timezone: "Z", charset: "utf8mb4" });
  try {
    await connection.query("SET time_zone = '+00:00'");
    // Several server processes may boot at once; only one may migrate at a time.
    const [lock] = await connection.query("SELECT GET_LOCK(?, ?) AS acquired", [
      LOCK_NAME,
      LOCK_TIMEOUT_SECONDS,
    ]);
    if ((lock as { acquired: number }[])[0]?.acquired !== 1) {
      throw new Error(`could not acquire the migration lock within ${LOCK_TIMEOUT_SECONDS}s`);
    }
    try {
      const applied = await applyPending(connection, migrations as Migration[]);
      console.log(`[migrate] database schema is up to date (${applied} migration(s) applied)`);
      return applied;
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]);
    }
  } finally {
    await connection.end();
  }
}

async function applyPending(connection: mysql.Connection, all: Migration[]): Promise<number> {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (id serial primary key, hash text not null, created_at bigint)`,
  );
  const [rows] = await connection.query(
    `SELECT created_at FROM \`${MIGRATIONS_TABLE}\` ORDER BY created_at DESC LIMIT 1`,
  );
  const last = (rows as { created_at: string | number }[])[0];
  const lastApplied = last ? Number(last.created_at) : -Infinity;

  let applied = 0;
  for (const migration of all) {
    if (migration.folderMillis <= lastApplied) continue;
    // MySQL commits DDL implicitly, so each statement is final once it runs. The
    // bookkeeping row is written only after the whole migration succeeded.
    for (const statement of migration.sql) {
      if (statement.trim()) await connection.query(statement);
    }
    await connection.query(`INSERT INTO \`${MIGRATIONS_TABLE}\` (hash, created_at) VALUES (?, ?)`, [
      migration.hash,
      migration.folderMillis,
    ]);
    applied++;
  }
  return applied;
}
