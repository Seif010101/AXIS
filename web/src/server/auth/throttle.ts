import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { throttles } from "@/server/db/schema";

export interface ThrottleRule {
  /** Hits allowed per window. */
  max: number;
  windowSeconds: number;
}

export interface ThrottleStatus {
  blocked: boolean;
  retryAfterSeconds: number;
}

// Fixed-window counters in the database, so limits hold across server instances and
// restarts (the legacy limiter was an in-process dict).

export async function throttleStatus(key: string, rule: ThrottleRule): Promise<ThrottleStatus> {
  const [row] = await db.select().from(throttles).where(eq(throttles.key, key)).limit(1);
  if (!row) return { blocked: false, retryAfterSeconds: 0 };
  const elapsed = (Date.now() - row.windowStartedAt.getTime()) / 1000;
  if (elapsed >= rule.windowSeconds || row.count < rule.max) return { blocked: false, retryAfterSeconds: 0 };
  return { blocked: true, retryAfterSeconds: Math.ceil(rule.windowSeconds - elapsed) };
}

/** Records one hit and returns the count inside the current window. */
export async function throttleHit(key: string, rule: ThrottleRule): Promise<number> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - rule.windowSeconds * 1000);
  // One atomic statement. MySQL evaluates the assignments left to right, so `count` is
  // computed from the old window start before that column is updated.
  await db
    .insert(throttles)
    .values({ key, count: 1, windowStartedAt: now })
    .onDuplicateKeyUpdate({
      set: {
        count: sql`IF(${throttles.windowStartedAt} <= ${windowStart}, 1, ${throttles.count} + 1)`,
        windowStartedAt: sql`IF(${throttles.windowStartedAt} <= ${windowStart}, ${now}, ${throttles.windowStartedAt})`,
      },
    });
  const [row] = await db
    .select({ count: throttles.count })
    .from(throttles)
    .where(eq(throttles.key, key))
    .limit(1);
  return row?.count ?? 1;
}

export async function throttleReset(key: string): Promise<void> {
  await db.delete(throttles).where(eq(throttles.key, key));
}
