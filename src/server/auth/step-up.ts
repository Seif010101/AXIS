import "server-only";
import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { AppError } from "@/server/errors";
import { auth } from "./auth";
import type { SessionContext } from "./session";
import { hasValidStepUp, recordStepUp, STEP_UP_TTL_SECONDS } from "./step-up-store";
import {
  consumeTotpCode,
  throttleExceeded,
  throttleKey,
  throttleReset,
  throttleStatus,
  type ThrottleRule,
} from "./throttle";

// "Sudo mode": high-risk actions need a TOTP code entered within the last few minutes,
// even when the user is already signed in. The grant is bound to the session.
export { STEP_UP_TTL_SECONDS };

// Better Auth only caps TOTP attempts during sign-in, so step-up carries its own cap.
// The raw /two-factor/verify-totp endpoint is closed to signed-in users (see guards.ts),
// so this function is the only way to test a code against a live session.
export const STEP_UP_ATTEMPT_RULE: ThrottleRule = { max: 5, windowSeconds: 15 * 60 };
export const stepUpAttemptKey = (userId: string) => throttleKey("step-up", userId);

export async function verifyStepUp(context: SessionContext, code: string): Promise<{ expiresAt: Date }> {
  // verifyTOTP on an unfinished enrollment would complete it as a side effect.
  if (!context.user.twoFactorEnabled) {
    throw new AppError("TWO_FACTOR_REQUIRED", "Two-factor authentication must be set up first");
  }

  const key = stepUpAttemptKey(context.user.id);
  if (await throttleExceeded(key, STEP_UP_ATTEMPT_RULE)) {
    const { retryAfterSeconds } = await throttleStatus(key, STEP_UP_ATTEMPT_RULE);
    throw new AppError("RATE_LIMITED", "Too many wrong codes. Try again later.", { retryAfterSeconds });
  }
  if (await consumeTotpCode(context.user.id, code)) {
    throw new AppError("VALIDATION", "This code was already used. Wait for the next one.");
  }

  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await headers() });
  } catch (error) {
    // Only a rejected code counts as a failure; infrastructure errors propagate.
    if (!isAPIError(error)) throw error;
    throw new AppError("VALIDATION", "Invalid code");
  }

  await throttleReset(key);
  return { expiresAt: await recordStepUp(context.sessionId, context.user.id) };
}

export async function hasStepUp(context: SessionContext): Promise<boolean> {
  return hasValidStepUp(context.sessionId);
}

/** Call at the top of every high-risk handler. The client reacts to STEP_UP_REQUIRED by asking for the code. */
export async function requireStepUp(context: SessionContext): Promise<void> {
  if (!(await hasStepUp(context))) {
    throw new AppError("STEP_UP_REQUIRED", "Enter your authenticator code to continue");
  }
}
