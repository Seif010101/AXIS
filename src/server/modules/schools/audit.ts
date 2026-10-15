import "server-only";
import type { SessionContext } from "@/server/auth/session";
import { throttleHit, throttleKey, type ThrottleRule } from "@/server/auth/throttle";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/errors";
import type { Executor } from "@/server/services/stars";

// Audit trail of administrative actions, stored as analytics events. The snapshot in
// event_data survives deletions (user_id / school_id become NULL). Never any password.
export const AUDIT_EVENTS = [
  "school_created",
  "school_updated",
  "school_deleted",
  "schools_imported",
  "accounts_imported",
  "account_created",
  "account_updated",
  "account_deleted",
  "account_activated",
  "account_deactivated",
  "password_reset",
  "credentials_reissued",
] as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export async function recordAudit(
  ctx: SessionContext,
  event: AuditEvent,
  data: { schoolId?: string | null } & Record<string, unknown>,
  executor: Executor = db,
): Promise<void> {
  const { schoolId = null, ...rest } = data;
  await executor.insert(schema.analyticsEvents).values({
    userId: ctx.user.id,
    schoolId,
    eventType: event,
    eventData: { actorEmail: ctx.user.email, actorRole: ctx.user.role, ...rest },
  });
}

// Per-actor rate limits on administrative actions.
export const RATE_RULES = {
  editSchool: { max: 30, windowSeconds: 3600 },
  importSchools: { max: 10, windowSeconds: 3600 },
  importAccounts: { max: 20, windowSeconds: 3600 },
  mintPassword: { max: 200, windowSeconds: 3600 },
  deleteAccount: { max: 100, windowSeconds: 3600 },
  deleteSchool: { max: 10, windowSeconds: 3600 },
} as const satisfies Record<string, ThrottleRule>;

/** Counts `amount` uses of an administrative action; throws RATE_LIMITED past the limit. */
export async function consumeRate(ctx: SessionContext, action: keyof typeof RATE_RULES, amount = 1): Promise<void> {
  const rule = RATE_RULES[action];
  const key = throttleKey("schools", action, ctx.user.id);
  let count = 0;
  for (let i = 0; i < amount; i++) count = await throttleHit(key, rule);
  if (count > rule.max) throw new AppError("RATE_LIMITED", "Too many administrative actions, try again later");
}
