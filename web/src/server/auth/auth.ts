import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { brand } from "@/config/brand";
import { env } from "@/env";
import { db, schema } from "@/server/db";
import { throttleHit, throttleReset, throttleStatus, type ThrottleRule } from "./throttle";

// Failed password attempts per account. Keyed by email, not IP: a whole classroom often
// shares one public IP, and the legacy per-IP limiter locked classes out.
export const LOGIN_FAILURE_RULE: ThrottleRule = { max: 8, windowSeconds: 15 * 60 };
const loginKey = (email: string) => `login:${email.trim().toLowerCase()}`;

const SIGN_IN_PATH = "/sign-in/email";
const CHANGE_PASSWORD_PATH = "/change-password";

export const auth = betterAuth({
  appName: brand.name,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],

  database: drizzleAdapter(db, { provider: "mysql", schema, usePlural: true }),

  advanced: {
    // Brand-neutral so the product rename doesn't sign everyone out.
    cookiePrefix: "app",
    database: { generateId: () => crypto.randomUUID() },
  },

  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "student", input: false },
      schoolId: { type: "string", required: false, input: false },
      grade: { type: "string", required: false, input: false },
      section: { type: "string", required: false, input: false },
      subject: { type: "string", required: false, input: false },
      ministryId: { type: "string", required: false, input: false },
      learningStyle: { type: "string", required: false, input: false },
      isActive: { type: "boolean", required: true, defaultValue: true, input: false },
      mustChangePassword: { type: "boolean", required: true, defaultValue: true, input: false },
      lastLoginAt: { type: "date", required: false, input: false },
    },
  },

  // Accounts are created by staff only (see server/services/accounts.ts).
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },

  // No cookie cache: every request re-reads the session and user, so deactivating an
  // account or changing a role takes effect immediately.
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  // Database-backed so limits hold across server instances. Per-IP limits stay generous
  // for shared school networks; brute force is stopped by the per-account lockout below.
  rateLimit: {
    enabled: env.NODE_ENV === "production",
    storage: "database",
    window: 60,
    max: 120,
    customRules: {
      [SIGN_IN_PATH]: { window: 60, max: 60 },
    },
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [user] = await db
            .select({ isActive: schema.users.isActive })
            .from(schema.users)
            .where(eq(schema.users.id, session.userId))
            .limit(1);
          if (!user?.isActive) {
            throw new APIError("FORBIDDEN", { code: "ACCOUNT_DISABLED", message: "Account is disabled" });
          }
        },
        after: async (session) => {
          try {
            const [user] = await db
              .select({ role: schema.users.role, schoolId: schema.users.schoolId })
              .from(schema.users)
              .where(eq(schema.users.id, session.userId))
              .limit(1);
            await db
              .update(schema.users)
              .set({ lastLoginAt: new Date() })
              .where(eq(schema.users.id, session.userId));
            await db.insert(schema.analyticsEvents).values({
              userId: session.userId,
              schoolId: user?.schoolId ?? null,
              eventType: "login",
              eventData: { role: user?.role },
            });
          } catch (error) {
            // Bookkeeping must never block a sign-in.
            console.error("login bookkeeping failed", error);
          }
        },
      },
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return;
      const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
      if (!email) return;
      const status = await throttleStatus(loginKey(email), LOGIN_FAILURE_RULE);
      if (status.blocked) {
        throw new APIError("TOO_MANY_REQUESTS", {
          code: "ACCOUNT_LOCKED",
          message: `Too many failed attempts. Try again in ${Math.ceil(status.retryAfterSeconds / 60)} minutes.`,
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const failed = isAPIError(ctx.context.returned);

      if (ctx.path === SIGN_IN_PATH) {
        const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
        if (!email) return;
        if (failed) await throttleHit(loginKey(email), LOGIN_FAILURE_RULE);
        else await throttleReset(loginKey(email));
        return;
      }

      if (ctx.path === CHANGE_PASSWORD_PATH && !failed) {
        const userId = ctx.context.session?.user.id ?? ctx.context.newSession?.user.id;
        if (userId) {
          await db.update(schema.users).set({ mustChangePassword: false }).where(eq(schema.users.id, userId));
        }
      }
    }),
  },

  plugins: [
    twoFactor({ issuer: brand.name }),
    nextCookies(), // must be last
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
