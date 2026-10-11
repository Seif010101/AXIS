import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { brand } from "@/config/brand";
import { env } from "@/env";
import { db, schema } from "@/server/db";
import { afterAuthRequest, beforeAuthRequest } from "./guards";

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
    // TODO(deploy): check which client-IP header Hostinger's proxy sets and configure
    // ipAddress.ipAddressHeaders / trustedProxies. Without it, a multi-hop
    // X-Forwarded-For makes every client share one rate-limit bucket.
  },

  // Users can't edit their own profile through Better Auth: name is set by staff and the
  // avatar goes through the app's settings API, which validates it.
  disabledPaths: ["/update-user"],

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

  // Per-IP limits, database-backed so they hold across instances. Kept generous for school
  // networks where a whole class shares one IP; per-account limits live in guards.ts.
  rateLimit: {
    enabled: env.NODE_ENV === "production",
    storage: "database",
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/email": { window: 60, max: 60 },
    },
  },

  databaseHooks: {
    session: {
      create: {
        // Runs for every way a session is created: sign-in, 2FA completion, rotation.
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

  hooks: { before: beforeAuthRequest, after: afterAuthRequest },

  plugins: [
    twoFactor({ issuer: brand.name }),
    nextCookies(), // must be last
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
