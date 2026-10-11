import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` needs no database. `migrate` reads DATABASE_URL from the
// environment (load .env.local first: `node --env-file=.env.local ...` or the npm scripts).
export default defineConfig({
  dialect: "mysql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "mysql://root@127.0.0.1:3306/axis_dev" },
  strict: true,
  verbose: true,
});
