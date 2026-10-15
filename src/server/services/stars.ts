import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { env } from "@/env";
import { db, schema } from "@/server/db";
import { isDuplicateKeyError } from "@/server/db/errors";

// Stars and streaks. The server is the only source of truth: features call awardStars()
// after they have verified the achievement themselves (never on a client's word).
//
// Every award is a star_ledger row. The unique index (user, kind, day, slot) turns the
// daily caps into a database guarantee, so two concurrent requests can't both take the
// last slot. users.stars_count is the running total, updated in the same transaction.

export const STAR_RULES = {
  daily_challenge_correct: { amount: 25, dailyCap: 1 },
  daily_challenge_attempt: { amount: 5, dailyCap: 1 },
  homework_submitted: { amount: 5, dailyCap: 5 },
  test_completed: { amount: 10, dailyCap: 5 },
  game_completed: { amount: 3, dailyCap: 5 },
  focus_session: { amount: 2, dailyCap: 6 },
  reflection: { amount: 3, dailyCap: 1 },
  mood_checkin: { amount: 1, dailyCap: 1 },
} as const satisfies Record<string, { amount: number; dailyCap: number }>;

export type StarKind = keyof typeof STAR_RULES;

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;

/** The calendar day (YYYY-MM-DD) of `at` in the schools' time zone. */
export function localDay(at: Date = new Date(), timeZone: string = env.APP_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** The day before a YYYY-MM-DD day. */
export function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export interface StarAward {
  /** Stars actually granted (0 when today's cap for this kind is already used up). */
  awarded: number;
  /** The student's new total. */
  total: number;
}

/**
 * Grants stars for a verified achievement, within the kind's daily cap, and counts the day
 * toward the streak. `amount` overrides the rule's default (e.g. a score-based award) and is
 * clamped to 0..100. Pass a transaction to make the award part of a larger write.
 */
export async function awardStars(
  userId: string,
  kind: StarKind,
  options: { amount?: number; at?: Date; executor?: Executor } = {},
): Promise<StarAward> {
  const rule = STAR_RULES[kind];
  const amount = Math.max(0, Math.min(100, Math.round(options.amount ?? rule.amount)));
  const at = options.at ?? new Date();
  const day = localDay(at);

  const run = async (tx: Executor): Promise<StarAward> => {
    await recordActivity(userId, { at, executor: tx });
    let awarded = 0;
    if (amount > 0) {
      const [{ used }] = await tx
        .select({ used: count() })
        .from(schema.starLedger)
        .where(
          and(
            eq(schema.starLedger.userId, userId),
            eq(schema.starLedger.kind, kind),
            eq(schema.starLedger.day, day),
          ),
        );
      for (let slot = used; slot < rule.dailyCap; slot++) {
        try {
          await tx.insert(schema.starLedger).values({ userId, kind, day, slot, amount });
          awarded = amount;
          break;
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error; // a concurrent award took this slot
        }
      }
      if (awarded > 0) {
        await tx
          .update(schema.users)
          .set({ starsCount: sql`${schema.users.starsCount} + ${awarded}` })
          .where(eq(schema.users.id, userId));
      }
    }
    const [user] = await tx
      .select({ total: schema.users.starsCount })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    return { awarded, total: user?.total ?? 0 };
  };

  return options.executor ? run(options.executor) : db.transaction(run);
}

/**
 * Counts today toward the streak: the first activity of a day extends the streak when the
 * previous activity was yesterday, otherwise restarts it at 1. Idempotent within a day.
 */
export async function recordActivity(
  userId: string,
  options: { at?: Date; executor?: Executor } = {},
): Promise<void> {
  const today = localDay(options.at ?? new Date());
  const yesterday = previousDay(today);
  const { users } = schema;
  const executor = options.executor ?? db;
  // The day guard makes this a no-op after the first activity of the day, and the row lock
  // of a single UPDATE stops concurrent first activities from double-incrementing. MySQL
  // evaluates SET assignments left to right, so current_streak must read last_streak_day
  // before it is overwritten (both the object and the column order put it first).
  const [result] = await executor
    .update(users)
    .set({
      currentStreak: sql`CASE WHEN ${users.lastStreakDay} = ${yesterday} THEN ${users.currentStreak} + 1 ELSE 1 END`,
      lastStreakDay: today,
    })
    .where(
      and(eq(users.id, userId), sql`(${users.lastStreakDay} IS NULL OR ${users.lastStreakDay} <> ${today})`),
    );
  if (result.affectedRows > 0) {
    await executor
      .update(users)
      .set({ longestStreak: sql`GREATEST(${users.longestStreak}, ${users.currentStreak})` })
      .where(eq(users.id, userId));
  }
}

/** The streak as of today: one whose last active day is before yesterday has lapsed (0). */
export function effectiveStreak(current: number, lastDay: string | null, at: Date = new Date()): number {
  if (!lastDay) return 0;
  const today = localDay(at);
  return lastDay === today || lastDay === previousDay(today) ? current : 0;
}
