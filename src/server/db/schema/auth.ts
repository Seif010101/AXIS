import {
  bigint,
  boolean,
  date,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { createdAt, id, pk, timestamp, updatedAt } from "./_columns";
import { schools } from "./school";

// Better Auth tables. Property names must match Better Auth's field names (the Drizzle
// adapter looks fields up by property); column names are ours.

export const users = mysqlTable(
  "users",
  {
    id: pk(),
    name: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(true),
    // Avatar: a preset id (av1..av12) or an https URL. Never base64.
    image: varchar("avatar", { length: 500 }),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),

    // Domain fields (declared as Better Auth additionalFields with input: false).
    role: varchar("role", { length: 20 }).notNull().default("student"),
    schoolId: id("school_id").references(() => schools.id, { onDelete: "set null" }),
    grade: varchar("grade", { length: 50 }),
    section: varchar("section", { length: 50 }),
    subject: varchar("subject", { length: 100 }),
    ministryId: varchar("ministry_id", { length: 50 }),
    learningStyle: varchar("learning_style", { length: 20 }),
    isActive: boolean("is_active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    lastLoginAt: timestamp("last_login_at"),

    // Cached gamification counters. star_ledger is the source of truth; these are
    // updated in the same transaction as each ledger insert.
    starsCount: int("stars_count").notNull().default(0),
    currentStreak: int("current_streak").notNull().default(0),
    longestStreak: int("longest_streak").notNull().default(0),
    lastStreakDay: date("last_streak_day", { mode: "string" }),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    index("users_school_role_idx").on(t.schoolId, t.role),
    index("users_class_idx").on(t.schoolId, t.grade, t.section),
    index("users_last_login_idx").on(t.lastLoginAt),
  ],
);

export const sessions = mysqlTable(
  "sessions",
  {
    id: pk(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("sessions_token_unique").on(t.token), index("sessions_user_idx").on(t.userId)],
);

export const accounts = mysqlTable(
  "accounts",
  {
    id: pk(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 100 }).notNull(),
    // Password hash for the "credential" provider. Never selected by app code.
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    uniqueIndex("accounts_provider_account_unique").on(t.providerId, t.accountId),
  ],
);

export const verifications = mysqlTable(
  "verifications",
  {
    id: pk(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const twoFactors = mysqlTable(
  "two_factors",
  {
    id: pk(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").default(true),
    failedVerificationCount: int("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until"),
  },
  (t) => [index("two_factors_user_idx").on(t.userId)],
);

export const rateLimits = mysqlTable(
  "rate_limits",
  {
    id: pk(),
    key: varchar("key", { length: 255 }).notNull(),
    count: int("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("rate_limits_key_unique").on(t.key)],
);

// A fresh TOTP verification for the current session ("sudo mode"). One row per session,
// valid until expires_at. Required by high-risk actions.
export const stepUps = mysqlTable("step_ups", {
  sessionId: id("session_id")
    .primaryKey()
    .references(() => sessions.id, { onDelete: "cascade" }),
  userId: id("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  verifiedAt: timestamp("verified_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Generic fixed-window counters for app-level limits (failed sign-ins per account,
// step-up attempts, AI quotas). See server/auth/throttle.ts.
export const throttles = mysqlTable("throttles", {
  key: varchar("key", { length: 191 }).primaryKey(),
  count: int("count").notNull().default(0),
  windowStartedAt: timestamp("window_started_at").notNull(),
});
