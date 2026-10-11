import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { resetDatabase } from "./helpers";

// The boot-time migrator and drizzle-kit must agree on what has been applied, so either
// can be used against the same database.
describe("boot-time migrator", () => {
  beforeAll(async () => {
    await resetDatabase(); // applies migrations with drizzle's own migrator
  });

  it("applies nothing on a database drizzle already migrated", async () => {
    const { runMigrations } = await import("@/server/db/migrate");
    expect(await runMigrations()).toBe(0);
  });

  it("builds the full schema on an empty database", async () => {
    const { db } = await import("@/server/db");
    await db.transaction(async (tx) => {
      const [rows] = await tx.execute(
        sql`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()`,
      );
      await tx.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
      for (const row of rows as unknown as { name: string }[]) {
        await tx.execute(sql.raw(`DROP TABLE \`${row.name}\``));
      }
      await tx.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    });

    const { runMigrations } = await import("@/server/db/migrate");
    expect(await runMigrations()).toBeGreaterThan(0);
    expect(await runMigrations()).toBe(0); // idempotent

    const [tables] = await db.execute(
      sql`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'`,
    );
    expect(Number((tables as unknown as { n: number }[])[0].n)).toBe(1);
  });
});
