import { beforeAll, describe, expect, it } from "vitest";
import { createUser } from "./fixtures";
import { resetDatabase } from "./helpers";

// 10:00 UTC is 14:00 in Asia/Dubai (the default APP_TIME_ZONE): same calendar day.
const DAY1 = new Date("2026-03-01T10:00:00Z");
const DAY2 = new Date("2026-03-02T10:00:00Z");
const DAY4 = new Date("2026-03-04T10:00:00Z");

async function readUser(id: string) {
  const { db, schema } = await import("@/server/db");
  const { eq } = await import("drizzle-orm");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  return user;
}

describe("stars and streaks", () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it("uses the schools' time zone for the day boundary", async () => {
    const { localDay, previousDay } = await import("@/server/services/stars");
    // 21:00 UTC on Mar 1 is already Mar 2 in Dubai (UTC+4).
    expect(localDay(new Date("2026-03-01T21:00:00Z"), "Asia/Dubai")).toBe("2026-03-02");
    expect(localDay(new Date("2026-03-01T21:00:00Z"), "UTC")).toBe("2026-03-01");
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
  });

  it("awards up to the daily cap and keeps users.stars_count in sync", async () => {
    const { awardStars, STAR_RULES } = await import("@/server/services/stars");
    const student = await createUser({ role: "student" });
    const results = [];
    for (let i = 0; i < STAR_RULES.game_completed.dailyCap + 2; i++) {
      results.push(await awardStars(student.id, "game_completed", { at: DAY1 }));
    }
    const granted = results.filter((r) => r.awarded > 0).length;
    expect(granted).toBe(STAR_RULES.game_completed.dailyCap);
    const expected = STAR_RULES.game_completed.dailyCap * STAR_RULES.game_completed.amount;
    expect(results.at(-1)).toEqual({ awarded: 0, total: expected });
    expect((await readUser(student.id)).starsCount).toBe(expected);

    // The cap resets the next day.
    expect((await awardStars(student.id, "game_completed", { at: DAY2 })).awarded).toBe(3);
  });

  it("enforces the cap under concurrent requests", async () => {
    const { awardStars } = await import("@/server/services/stars");
    const student = await createUser({ role: "student" });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => awardStars(student.id, "reflection", { at: DAY1 })),
    );
    expect(results.filter((r) => r.awarded > 0)).toHaveLength(1);
    expect((await readUser(student.id)).starsCount).toBe(3);
  });

  it("clamps custom amounts", async () => {
    const { awardStars } = await import("@/server/services/stars");
    const student = await createUser({ role: "student" });
    expect((await awardStars(student.id, "test_completed", { amount: 1_000, at: DAY1 })).awarded).toBe(100);
    expect((await awardStars(student.id, "test_completed", { amount: -5, at: DAY1 })).awarded).toBe(0);
  });

  it("extends the streak on consecutive days, once per day, and restarts after a gap", async () => {
    const { recordActivity } = await import("@/server/services/stars");
    const student = await createUser({ role: "student" });

    await recordActivity(student.id, { at: DAY1 });
    await Promise.all([recordActivity(student.id, { at: DAY1 }), recordActivity(student.id, { at: DAY1 })]);
    expect(await readUser(student.id)).toMatchObject({
      currentStreak: 1,
      longestStreak: 1,
      lastStreakDay: "2026-03-01",
    });

    await Promise.all([recordActivity(student.id, { at: DAY2 }), recordActivity(student.id, { at: DAY2 })]);
    expect(await readUser(student.id)).toMatchObject({ currentStreak: 2, longestStreak: 2 });

    await recordActivity(student.id, { at: DAY4 });
    expect(await readUser(student.id)).toMatchObject({
      currentStreak: 1,
      longestStreak: 2,
      lastStreakDay: "2026-03-04",
    });
  });
});
