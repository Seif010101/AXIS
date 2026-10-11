import "server-only";
import { APIError, createAuthMiddleware, getIP, getSessionFromCtx, isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { hasValidStepUp } from "./step-up-store";
import {
  consumeTotpCode,
  LOGIN_ACCOUNT_RULE,
  LOGIN_PAIR_RULE,
  loginThrottleKeys,
  throttleExceeded,
  throttleKey,
  throttleReset,
  type ThrottleRule,
} from "./throttle";

// Policy that Better Auth's endpoints don't enforce on their own. Every rule here closes
// a hole found in review; tests/api/auth.test.ts has a regression test for each.

const SIGN_IN = "/sign-in/email";
const CHANGE_PASSWORD = "/change-password";
const VERIFY_TOTP = "/two-factor/verify-totp";
const VERIFY_BACKUP_CODE = "/two-factor/verify-backup-code";

// Endpoints that check the current password of a signed-in user. Without a limit they
// are a password-guessing oracle for anyone holding a session.
const PASSWORD_CHECKING_PATHS = new Set([
  CHANGE_PASSWORD,
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/get-totp-uri",
  "/two-factor/generate-backup-codes",
]);
export const PASSWORD_ATTEMPT_RULE: ThrottleRule = { max: 8, windowSeconds: 15 * 60 };
export const passwordAttemptKey = (userId: string) => throttleKey("password", userId);

// Endpoints that reveal or replace the authenticator. Once 2FA is on, they also need a
// fresh code (step-up); otherwise the password alone would let an attacker swap in
// their own authenticator.
const AUTHENTICATOR_PATHS = new Set([
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/get-totp-uri",
  "/two-factor/generate-backup-codes",
]);

const tooMany = (code: string, message: string) => new APIError("TOO_MANY_REQUESTS", { code, message });

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

const bodyString = (ctx: HookContext, field: string) =>
  typeof ctx.body?.[field] === "string" ? (ctx.body[field] as string) : "";

const clientIp = (ctx: HookContext) => {
  const source = ctx.request ?? ctx.headers;
  return source ? getIP(source, ctx.context.options) : null;
};

export const beforeAuthRequest = createAuthMiddleware(async (ctx) => {
  if (ctx.path === SIGN_IN) {
    const email = bodyString(ctx, "email");
    if (!email) return;
    // Consume-first: count the attempt before the password is checked, so a parallel
    // burst can't get past the limit. Reset on success in the after hook.
    const keys = loginThrottleKeys(email, clientIp(ctx));
    const pairExceeded = await throttleExceeded(keys.pair, LOGIN_PAIR_RULE);
    const accountExceeded = await throttleExceeded(keys.account, LOGIN_ACCOUNT_RULE);
    if (pairExceeded || accountExceeded) {
      throw tooMany("ACCOUNT_LOCKED", "Too many failed attempts. Try again in 15 minutes.");
    }
    return;
  }

  if (PASSWORD_CHECKING_PATHS.has(ctx.path)) {
    const session = await getSessionFromCtx(ctx);
    if (!session) return; // the endpoint itself rejects unauthenticated calls

    if (
      ctx.path === CHANGE_PASSWORD &&
      bodyString(ctx, "newPassword") === bodyString(ctx, "currentPassword")
    ) {
      throw new APIError("BAD_REQUEST", {
        code: "SAME_PASSWORD",
        message: "The new password must be different from the current one",
      });
    }
    if (
      AUTHENTICATOR_PATHS.has(ctx.path) &&
      session.user.twoFactorEnabled &&
      !(await hasValidStepUp(session.session.id))
    ) {
      throw new APIError("FORBIDDEN", {
        code: "STEP_UP_REQUIRED",
        message: "Enter your authenticator code to continue",
      });
    }
    if (await throttleExceeded(passwordAttemptKey(session.user.id), PASSWORD_ATTEMPT_RULE)) {
      throw tooMany("PASSWORD_ATTEMPTS_EXCEEDED", "Too many wrong passwords. Try again in 15 minutes.");
    }
    return;
  }

  if (ctx.path === VERIFY_TOTP || ctx.path === VERIFY_BACKUP_CODE) {
    const session = await getSessionFromCtx(ctx);
    if (session) {
      // With a session Better Auth applies no attempt cap, which made this endpoint an
      // unlimited code oracle. Signed-in users with 2FA verify codes through step-up only
      // (server-side, capped). Enrollment (2FA not yet on) still works.
      if (ctx.request && session.user.twoFactorEnabled) {
        throw new APIError("FORBIDDEN", {
          code: "USE_STEP_UP",
          message: "Use the step-up endpoint to confirm a code while signed in",
        });
      }
      return;
    }
    // Second sign-in step: privileged accounts must enter a code at every sign-in, so
    // "trust this device" (a 30-day skip) is never honoured.
    if (ctx.body?.trustDevice) return { context: { body: { ...ctx.body, trustDevice: false } } };
  }
});

export const afterAuthRequest = createAuthMiddleware(async (ctx) => {
  const failed = isAPIError(ctx.context.returned);

  if (ctx.path === SIGN_IN) {
    const email = bodyString(ctx, "email");
    if (!email || failed) return;
    const keys = loginThrottleKeys(email, clientIp(ctx));
    await throttleReset(keys.pair);
    await throttleReset(keys.account);
    return;
  }

  const userId = ctx.context.newSession?.user.id ?? ctx.context.session?.user.id;

  if (PASSWORD_CHECKING_PATHS.has(ctx.path)) {
    if (failed || !userId) return;
    await throttleReset(passwordAttemptKey(userId));
    if (ctx.path === CHANGE_PASSWORD) {
      await db.update(schema.users).set({ mustChangePassword: false }).where(eq(schema.users.id, userId));
    }
    return;
  }

  if (ctx.path === VERIFY_TOTP && !failed && userId) {
    // Codes stay valid ~90 s; remember this one so it can't be replayed for step-up.
    await consumeTotpCode(userId, bodyString(ctx, "code"));
  }
});
