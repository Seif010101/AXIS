// Packs drizzle/*.sql into src/server/db/migrations.generated.json so the migrations ship
// inside the server bundle. The host deploys only parts of the build output, never the
// source tree, so the server can't read drizzle/ from disk.
//
// Runs as part of `npm run db:generate`. tests/unit/migrations.test.ts fails if the
// generated file is out of date.
import { writeFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";

const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
writeFileSync("src/server/db/migrations.generated.json", JSON.stringify(migrations, null, 2) + "\n");
console.log(`bundle-migrations: ${migrations.length} migration(s) written`);
