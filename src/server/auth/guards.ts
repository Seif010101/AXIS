import "server-only";
import { APIError, createAuthMiddleware, getIP, getSessionFromCtx, isAPIError } from "better-auth/api";
import { and, eq, notInArray } from "drizzle-orm";
import { env } from "@/env";
import { db, schema } from "@/server/db";
import { isRole, requiresTwoFactor } from "@/server/policy/roles";
import { hasValidStepUp } from "./step-up-store";
import {
  addKnownDevice,
  consumeTotpCode,
  KNOWN_DEVICE_COOKIE,
  KNOWN_DEVICE_MAX_AGE,
  knownDeviceTag,
  LOGIN_ACCOUNT_RULE,
  LOGIN_PAIR_RULE,
  loginThrottleKeys,
  parseKnownDevices,
  throttleExceeded,
  throttleKey,
  throttleReset,
  type ThrottleRule,
} from "./throttle";
import { TURNSTILE_HEADER, verifyTurnstileToken } from "./turnstile";

// Policy that Better Auth's endpoints don't enforce on their own. Every rule here closes
// a hole found in review; tests/api/auth.test.ts has a regression test for each.

const SIGN_IN = "/sign-in/email";
const CHANGE_PASSWORD = "/change-password";
const VERIFY_TOTP = "/two-factor/verify-totp";
const VERIFY_BACKUP_CODE = "/two-factor/verify-backup-code";
const DISABLE_TWO_FACTOR = "/two-factor/disable";

// Endpoints that check the current password of a signed-in user. Without a limit they
// are a password-guessing oracle for anyone holding a session.
const PASSWORD_CHECKING_PATHS = new Set([
  CHANGE_PASSWORD,
  "/two-factor/enable",
  DISABLE_TWO_FACTOR,
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
  DISABLE_TWO_FACTOR,
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

/**
 * Bot check (Cloudflare Turnstile) for a sign-in coming from a browser. Runs before the
 * password and the failed-attempt counters are touched, so a bot can't lock a real user
 * out either. Skipped when Turnstile isn't configured, and for server-internal calls.
 */
async function requireHuman(ctx: HookContext): Promise<void> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret || !ctx.request) return;
  const result = await verifyTurnstileToken({
    secret,
    token: ctx.request.headers.get(TURNSTILE_HEADER),
    ip: clientIp(ctx),
  });
  if (result.ok) return;
  if (result.reason === "unavailable") {
    console.error("turnstile verification unavailable", result.errorCodes ?? []);
    throw new APIError("SERVICE_UNAVAILABLE", {
      code: "BOT_CHECK_UNAVAILABLE",
      message: "The security check is unavailable right now. Try again in a moment.",
    });
  }
  throw new APIError("FORBIDDEN", {
    code: "BOT_CHECK_FAILED",
    message: "The security check failed. Try again.",
  });
}

export const beforeAuthRequest = createAuthMiddleware(async (ctx) => {
  if (ctx.path === SIGN_IN) {
    await requireHuman(ctx);
    const email = bodyString(ctx, "email");
    if (!email) return;
    // Consume-first: count the attempt before the password is checked, so a parallel
    // burst can't get past the limit. Reset on success in the after hook.
    const keys = loginThrottleKeys(email, clientIp(ctx));
    const pairExceeded = await throttleExceeded(keys.pair, LOGIN_PAIR_RULE);
    // A browser that signed in to this account before isn't held by the account-wide
    // lock, so strangers guessing from elsewhere can't lock the real user out.
    const knownDevice = parseKnownDevices(ctx.getCookie(KNOWN_DEVICE_COOKIE)).includes(
      knownDeviceTag(email, ctx.context.secret),
    );
    const accountExceeded = knownDevice ? false : await throttleExceeded(keys.account, LOGIN_ACCOUNT_RULE);
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
    // Two-step verification is mandatory: it can be moved to a new phone (enable again
    // with step-up) but never switched off. The UI has no button for it either.
    const role = session.user.role;
    if (ctx.path === DISABLE_TWO_FACTOR && (!isRole(role) || requiresTwoFactor(role))) {
      throw new APIError("FORBIDDEN", {
        code: "TWO_FACTOR_MANDATORY",
        message: "Two-step verification is required for every account and can't be turned off",
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
    // Second sign-in step: every account must enter a code at every sign-in, so
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
    ctx.setCookie(
      KNOWN_DEVICE_COOKIE,
      addKnownDevice(ctx.getCookie(KNOWN_DEVICE_COOKIE), knownDeviceTag(email, ctx.context.secret)),
      {
        httpOnly: true,
        secure: ctx.context.baseURL.startsWith("https://"),
        sameSite: "lax",
        path: "/api/auth",
        maxAge: KNOWN_DEVICE_MAX_AGE,
      },
    );
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
    const existing = ctx.context.session;
    const newSession = ctx.context.newSession;
    // Codes stay valid ~90 s; remember this one so it can't be replayed (step-up checks
    // the same record before verifying).
    const reused = await consumeTotpCode(userId, bodyString(ctx, "code"));

    // Second sign-in step: Better Auth keeps no record of used codes, so a code seen over
    // someone's shoulder (or relayed by a phishing page) would open a second session.
    // Undo the session that was just created and refuse.
    if (reused && newSession && !existing?.session) {
      await ctx.context.internalAdapter.deleteSession(newSession.session.token);
      throw new APIError("UNAUTHORIZED", {
        code: "INVALID_CODE",
        message: "This code was already used. Wait for the next one.",
      });
    }

    // Enrollment just finished (2FA was off for this session's user): sessions opened
    // elsewhere with the password alone must not inherit the new protection level.
    // Better Auth may rotate the session here, so both the old and the new one are kept.
    if (existing?.session && !existing.user.twoFactorEnabled) {
      const keep = [existing.session.id, newSession?.session.id].filter((id): id is string => Boolean(id));
      await db
        .delete(schema.sessions)
        .where(and(eq(schema.sessions.userId, userId), notInArray(schema.sessions.id, keep)));
    }
  }
});
