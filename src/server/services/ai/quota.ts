import "server-only";
import { and, count, eq, gte, inArray, notInArray } from "drizzle-orm";
import { env } from "@/env";
import type { Actor } from "@/server/policy/scope";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/errors";
import { localDay } from "@/server/services/stars";
import { imageModelIds } from "./config";
import { dailyLimit, type AiQuotaKind } from "./limits";

// Quotas and usage accounting share the ai_usage table: every model call is one row.
//
// A call first *reserves* its row (0 tokens), then counts today's rows including its own.
// Over the limit, it removes the reservation and fails with RATE_LIMITED. Because the row
// is written before the count, parallel requests can never push a user past the limit
// (at worst two racing requests both get refused). After the call the row receives the
// real token counts; a failed call releases its reservation, so failures cost nothing.

/** Token counts of one call. */
export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

/** UTC offset (ms) of a time zone at an instant. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant at which the local day containing `at` started in `timeZone`. */
export function startOfLocalDay(at: Date = new Date(), timeZone: string = env.APP_TIME_ZONE): Date {
  const midnightAsUtc = Date.parse(`${localDay(at, timeZone)}T00:00:00Z`);
  let start = midnightAsUtc - zoneOffsetMs(new Date(midnightAsUtc), timeZone);
  // Daylight-saving zones: the offset at the real midnight can differ from the guess.
  const corrected = midnightAsUtc - zoneOffsetMs(new Date(start), timeZone);
  if (corrected !== start) start = corrected;
  return new Date(start);
}

/** Today's calls of a user for one quota kind (SQL count). */
export async function usedToday(userId: string, kind: AiQuotaKind, at: Date = new Date()): Promise<number> {
  const images = imageModelIds();
  const [{ used }] = await db
    .select({ used: count() })
    .from(schema.aiUsage)
    .where(
      and(
        eq(schema.aiUsage.userId, userId),
        gte(schema.aiUsage.createdAt, startOfLocalDay(at)),
        kind === "image" ? inArray(schema.aiUsage.model, images) : notInArray(schema.aiUsage.model, images),
      ),
    );
  return used;
}

export interface Reservation {
  id: string;
}

/**
 * Reserves one call for `actor` against today's quota and returns the ai_usage row to
 * finalize. Throws RATE_LIMITED when the daily limit for the role is used up.
 */
export async function reserveCall(
  actor: Actor,
  input: { feature: string; model: string; kind: AiQuotaKind },
): Promise<Reservation> {
  const id = crypto.randomUUID();
  await db.insert(schema.aiUsage).values({
    id,
    userId: actor.id,
    schoolId: actor.schoolId,
    feature: input.feature,
    model: input.model,
    inputTokens: 0,
    outputTokens: 0,
  });
  const limit = dailyLimit(actor.role, input.kind);
  if (limit !== null && (await usedToday(actor.id, input.kind)) > limit) {
    await releaseCall({ id });
    throw new AppError("RATE_LIMITED", `Daily AI ${input.kind} limit reached`, {
      reason: "ai_daily_limit",
      kind: input.kind,
      limit,
    });
  }
  return { id };
}

const clampTokens = (value: number | undefined) =>
  Math.max(0, Math.min(2_000_000_000, Math.round(Number.isFinite(value) ? (value ?? 0) : 0)));

/** Writes the real token counts of a finished call. */
export async function finalizeCall(reservation: Reservation, usage: Partial<AiUsage>): Promise<void> {
  await db
    .update(schema.aiUsage)
    .set({ inputTokens: clampTokens(usage.inputTokens), outputTokens: clampTokens(usage.outputTokens) })
    .where(eq(schema.aiUsage.id, reservation.id));
}

/** Removes the reservation of a call that failed before producing anything. */
export async function releaseCall(reservation: Reservation): Promise<void> {
  await db.delete(schema.aiUsage).where(eq(schema.aiUsage.id, reservation.id));
}
