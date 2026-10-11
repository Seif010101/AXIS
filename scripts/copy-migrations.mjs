// Runs after `next build`. The host deploys only `.next`, `node_modules` and package.json,
// not the source tree, so the SQL migrations are copied into `.next/drizzle` for
// src/server/db/migrate.ts to apply when the server starts.
import { cpSync, existsSync } from "node:fs";

if (!existsSync("drizzle/meta/_journal.json")) {
  console.error("copy-migrations: drizzle/meta/_journal.json not found");
  process.exit(1);
}
cpSync("drizzle", ".next/drizzle", { recursive: true });
console.log("copy-migrations: copied drizzle/ to .next/drizzle");
