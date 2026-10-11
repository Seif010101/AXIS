import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";
import bundled from "@/server/db/migrations.generated.json";

describe("bundled migrations", () => {
  it("match drizzle/ exactly (run `npm run db:generate` after changing the schema)", () => {
    expect(bundled).toEqual(readMigrationFiles({ migrationsFolder: "drizzle" }));
  });
});
