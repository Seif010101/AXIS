import "server-only";
import { createHash, randomInt } from "node:crypto";
import { eq, like, lt, sql } from "drizzle-orm";
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
//
// Callers use consume-first: record the hit, then decide. Checking first and counting
// after the (slow) verification let parallel bursts slip past the limit.

/** Keys built from user input are hashed: bounded length, no raw emails or codes stored. */
export function throttleKey(prefix: string, ...parts: string[]): string {
  const digest = createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 40);
  return `${prefix}:${digest}`;
}

export async function throttleStatus(key: string, rule: ThrottleRule): Promise<ThrottleStatus> {
  const [row] = await db.select().from(throttles).where(eq(throttles.key, key)).limit(1);
  if (!row) return { blocked: false, retryAfterSeconds: 0 };
  const elapsed = (Date.now() - row.windowStartedAt.getTime()) / 1000;
  if (elapsed >= rule.windowSeconds || row.count < rule.max) return { blocked: false, retryAfterSeconds: 0 };
  return { blocked: true, retryAfterSeconds: Math.ceil(rule.windowSeconds - elapsed) };
}

/** Records one hit and returns the count inside the current window (including this hit). */
export async function throttleHit(key: string, rule: ThrottleRule): Promise<number> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - rule.windowSeconds * 1000);
  // One atomic statement (the key is the primary key, so the row is locked). MySQL and
  // MariaDB evaluate the assignments in column order, so `count` is computed from the old
  // window start before that column is updated.
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

  // Unauthenticated callers can create rows with junk input; prune stale ones now and then.
  if (randomInt(100) === 0) {
    await db.delete(throttles).where(lt(throttles.windowStartedAt, new Date(now.getTime() - 86_400_000)));
  }
  return row?.count ?? 1;
}

/** Consume-first check: counts this attempt and reports whether it exceeds the rule. */
export async function throttleExceeded(key: string, rule: ThrottleRule): Promise<boolean> {
  return (await throttleHit(key, rule)) > rule.max;
}

export async function throttleReset(key: string): Promise<void> {
  await db.delete(throttles).where(eq(throttles.key, key));
}

// ---------------------------------------------------------------------------
// Sign-in lockout.
// A strict limit per (account, client IP), so a classroom sharing one IP isn't locked
// out by one student and an attacker can't lock a victim out from another network, plus
// a higher per-account ceiling across all IPs against distributed guessing.

export const LOGIN_PAIR_RULE: ThrottleRule = { max: 8, windowSeconds: 15 * 60 };
export const LOGIN_ACCOUNT_RULE: ThrottleRule = { max: 50, windowSeconds: 15 * 60 };

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function loginThrottleKeys(email: string, ip: string | null) {
  const account = throttleKey("login-account", normalizeEmail(email));
  return {
    account,
    pair: `${throttleKey("login-pair", normalizeEmail(email))}:${throttleKey("ip", ip ?? "unknown").slice(3, 19)}`,
  };
}

/** Clears every sign-in counter for an account, e.g. after a staff password reset. */
export async function clearLoginThrottles(email: string): Promise<void> {
  const { account } = loginThrottleKeys(email, null);
  const pairPrefix = throttleKey("login-pair", normalizeEmail(email));
  await db.delete(throttles).where(eq(throttles.key, account));
  await db.delete(throttles).where(like(throttles.key, `${pairPrefix}:%`));
}

// ---------------------------------------------------------------------------
// TOTP codes are valid for about 90 seconds and Better Auth keeps no record of use, so
// we do: a code accepted once (sign-in, enrollment or step-up) is refused afterwards.

const TOTP_REUSE_RULE: ThrottleRule = { max: 1, windowSeconds: 120 };

/** Marks the code as used and returns true if it had already been used. */
export async function consumeTotpCode(userId: string, code: string): Promise<boolean> {
  return throttleExceeded(throttleKey("totp-used", userId, code.trim()), TOTP_REUSE_RULE);
}
