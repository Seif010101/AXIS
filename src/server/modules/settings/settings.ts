import "server-only";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { z } from "zod";
import { defaultLocale, isLocale, locales, type Locale } from "@/i18n/config";
import {
  AVATAR_PREFIX,
  AVATAR_PRESETS,
  DIFFICULTIES,
  HOBBIES_MAX,
  HOBBY_MAX_LENGTH,
  TUTOR_PERSONALITIES,
  type AvatarPreset,
  type Difficulty,
  type TutorPersonality,
} from "@/lib/preferences";
import type { SessionContext } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/errors";
import { requiresTwoFactor, type Role } from "@/server/policy/roles";

// The signed-in user's own profile, preferences, sessions and 2FA status. Every function
// works on ctx.user.id only: there is no way to address another user's settings.

const { users, userSettings, schools, sessions, twoFactors } = schema;

// ---------------------------------------------------------------------------- profile

export interface Profile {
  name: string;
  email: string;
  role: Role;
  image: string | null;
  schoolName: string | null;
  grade: string | null;
  section: string | null;
  subject: string | null;
}

export async function getProfile(ctx: SessionContext): Promise<Profile> {
  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      image: users.image,
      schoolName: schools.name,
      grade: users.grade,
      section: users.section,
      subject: users.subject,
    })
    .from(users)
    .leftJoin(schools, eq(schools.id, users.schoolId))
    .where(eq(users.id, ctx.user.id))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "User not found");
  return { ...row, role: ctx.user.role };
}

export const avatarSchema = z.object({ preset: z.enum(AVATAR_PRESETS).nullable() });

/** Sets (or clears, with null) the user's preset avatar. Only known preset ids are stored. */
export async function setAvatar(ctx: SessionContext, preset: AvatarPreset | null): Promise<string | null> {
  const image = preset ? `${AVATAR_PREFIX}${preset}` : null;
  await db.update(users).set({ image }).where(eq(users.id, ctx.user.id));
  return image;
}

// ------------------------------------------------------------------------ preferences

export interface Preferences {
  language: Locale;
  notificationsEnabled: boolean;
  difficulty: Difficulty;
  hobbies: string[];
  tutorPersonality: TutorPersonality;
}

const DEFAULTS: Omit<Preferences, "language"> = {
  notificationsEnabled: true,
  difficulty: "medium",
  hobbies: [],
  tutorPersonality: "friend",
};

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

/** The saved language, or null when the user never saved preferences. */
export async function getSavedLanguage(userId: string): Promise<Locale | null> {
  const [row] = await db
    .select({ language: userSettings.language })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row && isLocale(row.language) ? row.language : null;
}

export async function getPreferences(ctx: SessionContext, fallbackLanguage: Locale = defaultLocale): Promise<Preferences> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);
  if (!row) return { ...DEFAULTS, language: fallbackLanguage };
  return {
    language: isLocale(row.language) ? row.language : fallbackLanguage,
    notificationsEnabled: row.notificationsEnabled,
    difficulty: pick(DIFFICULTIES, row.difficulty, DEFAULTS.difficulty),
    hobbies: Array.isArray(row.hobbies) ? row.hobbies.filter((hobby) => typeof hobby === "string") : [],
    tutorPersonality: pick(TUTOR_PERSONALITIES, row.tutorPersonality, DEFAULTS.tutorPersonality),
  };
}

const hobbySchema = z.string().trim().min(1).max(HOBBY_MAX_LENGTH);

export const languageSchema = z.object({ language: z.enum(locales) });
export const notificationsSchema = z.object({ enabled: z.boolean() });
export const learningSchema = z.object({
  difficulty: z.enum(DIFFICULTIES),
  tutorPersonality: z.enum(TUTOR_PERSONALITIES),
  hobbies: z
    .array(hobbySchema)
    .max(HOBBIES_MAX)
    // Case-insensitive de-duplication, keeping the first spelling.
    .transform((list) => list.filter((hobby, i) => list.findIndex((h) => h.toLowerCase() === hobby.toLowerCase()) === i)),
});

type Patch = Partial<{
  language: Locale;
  notificationsEnabled: boolean;
  difficulty: Difficulty;
  hobbies: string[];
  tutorPersonality: TutorPersonality;
}>;

/**
 * Upserts the user's settings row. `language` falls back to the UI language the user is
 * currently using, so saving another preference never silently switches them to Arabic.
 */
async function savePreferences(ctx: SessionContext, patch: Patch, currentLanguage: Locale): Promise<void> {
  await db
    .insert(userSettings)
    .values({ userId: ctx.user.id, language: patch.language ?? currentLanguage, ...patch })
    .onDuplicateKeyUpdate({ set: { ...patch, updatedAt: new Date() } });
}

export async function setLanguage(ctx: SessionContext, language: Locale): Promise<void> {
  await savePreferences(ctx, { language }, language);
}

export async function setNotificationsEnabled(
  ctx: SessionContext,
  enabled: boolean,
  currentLanguage: Locale,
): Promise<void> {
  await savePreferences(ctx, { notificationsEnabled: enabled }, currentLanguage);
}

/** Learning preferences feed the AI tutor; they exist for students only. */
export async function setLearningPreferences(
  ctx: SessionContext,
  input: z.output<typeof learningSchema>,
  currentLanguage: Locale,
): Promise<void> {
  if (ctx.user.role !== "student") {
    throw new AppError("FORBIDDEN", "Learning preferences are for students");
  }
  await savePreferences(ctx, input, currentLanguage);
}

// --------------------------------------------------------------------------- security

export interface TwoFactorStatus {
  enabled: boolean;
  /** Required for the role (owner, manager, admin): cannot be turned off. */
  required: boolean;
  /** Enrollment was started (secret generated) but the first code was never verified. */
  pending: boolean;
}

export async function getTwoFactorStatus(ctx: SessionContext): Promise<TwoFactorStatus> {
  const [row] = await db
    .select({ verified: twoFactors.verified })
    .from(twoFactors)
    .where(eq(twoFactors.userId, ctx.user.id))
    .limit(1);
  return {
    enabled: ctx.user.twoFactorEnabled,
    required: requiresTwoFactor(ctx.user.role),
    pending: !ctx.user.twoFactorEnabled && row !== undefined && row.verified === false,
  };
}

export interface ActiveSession {
  id: string;
  current: boolean;
  createdAt: Date;
  lastActiveAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

/** The user's unexpired sessions, most recently active first. Tokens never leave the server. */
export async function listSessions(ctx: SessionContext): Promise<ActiveSession[]> {
  const rows = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, ctx.user.id), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.updatedAt));
  return rows
    .map((row) => ({
      id: row.id,
      current: row.id === ctx.sessionId,
      createdAt: row.createdAt,
      lastActiveAt: row.updatedAt,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

export const revokeSessionSchema = z.object({ sessionId: z.uuid() });

/** Signs out one of the user's other devices. The current session is ended with sign-out instead. */
export async function revokeSession(ctx: SessionContext, sessionId: string): Promise<void> {
  if (sessionId === ctx.sessionId) {
    throw new AppError("VALIDATION", "Use sign out to end the current session");
  }
  const [result] = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, ctx.user.id)));
  // Another user's session id is indistinguishable from a missing one.
  if (result.affectedRows === 0) throw new AppError("NOT_FOUND", "Session not found");
}

/** Signs out every other device. Returns how many sessions were ended. */
export async function revokeOtherSessions(ctx: SessionContext): Promise<number> {
  const [result] = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, ctx.user.id), ne(sessions.id, ctx.sessionId)));
  return result.affectedRows;
}
