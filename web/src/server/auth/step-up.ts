import "server-only";
import { isAPIError } from "better-auth/api";
import { and, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { AppError } from "@/server/errors";
import { db } from "@/server/db";
import { stepUps } from "@/server/db/schema";
import { auth } from "./auth";
import type { SessionContext } from "./session";
import { throttleHit, throttleReset, throttleStatus, type ThrottleRule } from "./throttle";

// "Sudo mode": high-risk actions need a TOTP code entered within the last few minutes,
// even when the user is already signed in.
export const STEP_UP_TTL_SECONDS = 5 * 60;

// Better Auth only caps TOTP attempts during sign-in. Verifying with an active session
// has no cap, so step-up carries its own.
export const STEP_UP_ATTEMPT_RULE: ThrottleRule = { max: 5, windowSeconds: 15 * 60 };
const attemptKey = (userId: string) => `step-up:${userId}`;

export async function verifyStepUp(context: SessionContext, code: string): Promise<{ expiresAt: Date }> {
  // verifyTOTP on an unfinished enrollment would complete it as a side effect.
  if (!context.user.twoFactorEnabled) {
    throw new AppError("TWO_FACTOR_REQUIRED", "Two-factor authentication must be set up first");
  }

  const key = attemptKey(context.user.id);
  const status = await throttleStatus(key, STEP_UP_ATTEMPT_RULE);
  if (status.blocked) {
    throw new AppError("RATE_LIMITED", "Too many wrong codes. Try again later.", {
      retryAfterSeconds: status.retryAfterSeconds,
    });
  }

  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await headers() });
  } catch (error) {
    // Only a rejected code counts as an attempt; infrastructure failures propagate.
    if (!isAPIError(error)) throw error;
    await throttleHit(key, STEP_UP_ATTEMPT_RULE);
    throw new AppError("VALIDATION", "Invalid code");
  }
  await throttleReset(key);

  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt.getTime() + STEP_UP_TTL_SECONDS * 1000);
  await db
    .insert(stepUps)
    .values({ sessionId: context.sessionId, userId: context.user.id, verifiedAt, expiresAt })
    .onDuplicateKeyUpdate({ set: { verifiedAt, expiresAt } });
  return { expiresAt };
}

export async function hasStepUp(context: SessionContext): Promise<boolean> {
  const [row] = await db
    .select({ sessionId: stepUps.sessionId })
    .from(stepUps)
    .where(and(eq(stepUps.sessionId, context.sessionId), gt(stepUps.expiresAt, new Date())))
    .limit(1);
  return Boolean(row);
}

/** Call at the top of every high-risk handler. The client reacts to STEP_UP_REQUIRED by asking for the code. */
export async function requireStepUp(context: SessionContext): Promise<void> {
  if (!(await hasStepUp(context))) {
    throw new AppError("STEP_UP_REQUIRED", "Enter your authenticator code to continue");
  }
}
