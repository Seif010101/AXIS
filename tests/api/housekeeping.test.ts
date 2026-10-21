import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/server/db";
import { runHousekeeping } from "@/server/housekeeping";
import { createUser } from "./fixtures";
import { resetDatabase } from "./helpers";

const HOUR = 3_600_000;

describe("housekeeping", () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it("removes expired auth rows, stale counters and cache, and keeps live ones", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - HOUR);
    const future = new Date(now.getTime() + HOUR);
    const user = await createUser({ role: "student" });

    const session = (expiresAt: Date) => ({
      id: crypto.randomUUID(),
      userId: user.id,
      token: crypto.randomUUID(),
      expiresAt,
    });
    const live = session(future);
    const ended = session(past);
    await db.insert(schema.sessions).values([live, ended]);
    await db
      .insert(schema.stepUps)
      .values({ sessionId: live.id, userId: user.id, verifiedAt: now, expiresAt: past });
    await db.insert(schema.verifications).values([
      { id: crypto.randomUUID(), identifier: "old", value: "x", expiresAt: past },
      { id: crypto.randomUUID(), identifier: "new", value: "x", expiresAt: future },
    ]);
    await db.insert(schema.rateLimits).values([
      { id: crypto.randomUUID(), key: "old", count: 1, lastRequest: now.getTime() - 48 * HOUR },
      { id: crypto.randomUUID(), key: "new", count: 1, lastRequest: now.getTime() },
    ]);
    await db.insert(schema.throttles).values([
      { key: "old", count: 3, windowStartedAt: new Date(now.getTime() - 48 * HOUR) },
      { key: "new", count: 3, windowStartedAt: now },
    ]);
    await db.insert(schema.contentCache).values([
      { cacheKey: "a".repeat(64), contentType: "t", content: {}, expiresAt: past },
      { cacheKey: "b".repeat(64), contentType: "t", content: {}, expiresAt: future },
    ]);

    const result = await runHousekeeping(process.env.DATABASE_URL, now);
    expect(result).toEqual({
      sessions: 1,
      stepUps: 1,
      verifications: 1,
      rateLimits: 1,
      throttles: 1,
      contentCache: 1,
    });

    expect((await db.select().from(schema.sessions)).map((s) => s.id)).toEqual([live.id]);
    expect((await db.select().from(schema.verifications)).map((v) => v.identifier)).toEqual(["new"]);
    expect((await db.select().from(schema.rateLimits)).map((r) => r.key)).toEqual(["new"]);
    expect(await db.select().from(schema.throttles).where(eq(schema.throttles.key, "new"))).toHaveLength(1);
    expect(await db.select().from(schema.throttles).where(eq(schema.throttles.key, "old"))).toHaveLength(0);
    expect(await db.select().from(schema.contentCache)).toHaveLength(1);
  });
});
