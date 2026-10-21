import { beforeAll, describe, expect, it } from "vitest";
import { contextFor, createSchool, createUser } from "./fixtures";
import { resetDatabase } from "./helpers";

// src/server/modules/settings: every function works on the caller's own account only.

const HOUR = 60 * 60 * 1000;

async function addSession(userId: string, overrides: { expiresAt?: Date; updatedAt?: Date; userAgent?: string } = {}) {
  const { db, schema } = await import("@/server/db");
  const id = crypto.randomUUID();
  await db.insert(schema.sessions).values({
    id,
    userId,
    token: crypto.randomUUID(),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 24 * HOUR),
    ipAddress: "203.0.113.7",
    userAgent: overrides.userAgent ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36",
    updatedAt: overrides.updatedAt ?? new Date(),
  });
  return id;
}

async function sessionExists(id: string) {
  const { db, schema } = await import("@/server/db");
  const { eq } = await import("drizzle-orm");
  const rows = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.id, id));
  return rows.length === 1;
}

async function readSettings(userId: string) {
  const { db, schema } = await import("@/server/db");
  const { eq } = await import("drizzle-orm");
  const [row] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
  return row;
}

async function readImage(userId: string) {
  const { db, schema } = await import("@/server/db");
  const { eq } = await import("drizzle-orm");
  const [row] = await db.select({ image: schema.users.image }).from(schema.users).where(eq(schema.users.id, userId));
  return row?.image ?? null;
}

describe("settings module", () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  describe("profile and avatar", () => {
    it("returns the caller's own profile with the school name", async () => {
      const { getProfile } = await import("@/server/modules/settings/settings");
      const school = await createSchool("Settings Academy");
      const student = await createUser({ role: "student", schoolId: school.id, grade: "7", section: "B" });
      const profile = await getProfile(contextFor(student));
      expect(profile).toMatchObject({
        name: student.name,
        email: student.email,
        role: "student",
        schoolName: "Settings Academy",
        grade: "7",
        section: "B",
      });
    });

    it("has no school for the platform owner", async () => {
      const { getProfile } = await import("@/server/modules/settings/settings");
      const owner = await createUser({ role: "owner", twoFactorEnabled: true });
      expect((await getProfile(contextFor(owner))).schoolName).toBeNull();
    });

    it("stores a preset avatar as preset:<id> and clears it with null", async () => {
      const { setAvatar } = await import("@/server/modules/settings/settings");
      const teacher = await createUser({ role: "teacher" });
      const other = await createUser({ role: "teacher" });
      const ctx = contextFor(teacher);

      expect(await setAvatar(ctx, "ocean")).toBe("preset:ocean");
      expect(await readImage(teacher.id)).toBe("preset:ocean");
      // Only the caller's row changes.
      expect(await readImage(other.id)).toBeNull();

      expect(await setAvatar(ctx, null)).toBeNull();
      expect(await readImage(teacher.id)).toBeNull();
    });

    it("accepts only known preset ids", async () => {
      const { avatarSchema } = await import("@/server/modules/settings/settings");
      const { AVATAR_PRESETS } = await import("@/lib/preferences");
      for (const preset of AVATAR_PRESETS) expect(avatarSchema.safeParse({ preset }).success).toBe(true);
      expect(avatarSchema.safeParse({ preset: null }).success).toBe(true);
      for (const preset of ["unknown", "preset:ocean", "https://evil.example/x.png", "", 3]) {
        expect(avatarSchema.safeParse({ preset }).success).toBe(false);
      }
      expect(avatarSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("preferences", () => {
    it("returns defaults in the current UI language before anything is saved", async () => {
      const { getPreferences, getSavedLanguage } = await import("@/server/modules/settings/settings");
      const student = await createUser({ role: "student" });
      expect(await getPreferences(contextFor(student), "fr")).toEqual({
        language: "fr",
        notificationsEnabled: true,
        difficulty: "medium",
        hobbies: [],
        tutorPersonality: "friend",
      });
      expect(await getSavedLanguage(student.id)).toBeNull();
    });

    it("saves the language and restores it at the next sign-in", async () => {
      const { getSavedLanguage, setLanguage, getPreferences } = await import("@/server/modules/settings/settings");
      const teacher = await createUser({ role: "teacher" });
      const ctx = contextFor(teacher);
      await setLanguage(ctx, "de");
      expect(await getSavedLanguage(teacher.id)).toBe("de");
      await setLanguage(ctx, "zh");
      expect(await getSavedLanguage(teacher.id)).toBe("zh");
      expect((await getPreferences(ctx, "ar")).language).toBe("zh");
    });

    it("keeps the user's current language when another preference creates the row", async () => {
      const { setNotificationsEnabled, getPreferences } = await import("@/server/modules/settings/settings");
      const admin = await createUser({ role: "admin" });
      const ctx = contextFor(admin);
      await setNotificationsEnabled(ctx, false, "es");
      expect(await getPreferences(ctx)).toMatchObject({ language: "es", notificationsEnabled: false });
      await setNotificationsEnabled(ctx, true, "en");
      // An existing row keeps its saved language.
      expect(await getPreferences(ctx)).toMatchObject({ language: "es", notificationsEnabled: true });
    });

    it("never changes another user's settings", async () => {
      const { setLanguage, setNotificationsEnabled } = await import("@/server/modules/settings/settings");
      const first = await createUser({ role: "student" });
      const second = await createUser({ role: "student" });
      await setLanguage(contextFor(second), "en");
      await setLanguage(contextFor(first), "fr");
      await setNotificationsEnabled(contextFor(first), false, "fr");
      expect(await readSettings(second.id)).toMatchObject({ language: "en", notificationsEnabled: true });
      expect(await readSettings(first.id)).toMatchObject({ language: "fr", notificationsEnabled: false });
    });

    it("rejects languages outside the six supported locales", async () => {
      const { languageSchema } = await import("@/server/modules/settings/settings");
      expect(languageSchema.safeParse({ language: "ar" }).success).toBe(true);
      expect(languageSchema.safeParse({ language: "it" }).success).toBe(false);
      expect(languageSchema.safeParse({ language: "en-US" }).success).toBe(false);
    });

    it("saves students' learning preferences", async () => {
      const { learningSchema, setLearningPreferences, getPreferences } = await import(
        "@/server/modules/settings/settings"
      );
      const student = await createUser({ role: "student" });
      const ctx = contextFor(student);
      const input = learningSchema.parse({
        difficulty: "hard",
        tutorPersonality: "scientist",
        hobbies: ["  Football ", "drawing", "football"],
      });
      expect(input.hobbies).toEqual(["Football", "drawing"]);
      await setLearningPreferences(ctx, input, "en");
      expect(await getPreferences(ctx)).toMatchObject({
        language: "en",
        difficulty: "hard",
        tutorPersonality: "scientist",
        hobbies: ["Football", "drawing"],
      });
    });

    it("validates learning preferences", async () => {
      const { learningSchema } = await import("@/server/modules/settings/settings");
      const { HOBBIES_MAX, HOBBY_MAX_LENGTH } = await import("@/lib/preferences");
      const valid = { difficulty: "easy", tutorPersonality: "coach", hobbies: [] };
      expect(learningSchema.safeParse(valid).success).toBe(true);
      expect(learningSchema.safeParse({ ...valid, difficulty: "extreme" }).success).toBe(false);
      expect(learningSchema.safeParse({ ...valid, tutorPersonality: "pirate" }).success).toBe(false);
      expect(learningSchema.safeParse({ ...valid, hobbies: ["   "] }).success).toBe(false);
      expect(learningSchema.safeParse({ ...valid, hobbies: ["x".repeat(HOBBY_MAX_LENGTH + 1)] }).success).toBe(false);
      const tooMany = Array.from({ length: HOBBIES_MAX + 1 }, (_, i) => `hobby ${i}`);
      expect(learningSchema.safeParse({ ...valid, hobbies: tooMany }).success).toBe(false);
    });

    it("refuses learning preferences for non-students", async () => {
      const { setLearningPreferences } = await import("@/server/modules/settings/settings");
      const teacher = await createUser({ role: "teacher" });
      await expect(
        setLearningPreferences(contextFor(teacher), { difficulty: "easy", tutorPersonality: "friend", hobbies: [] }, "en"),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await readSettings(teacher.id)).toBeUndefined();
    });

    it("ignores unknown stored values instead of passing them on", async () => {
      const { db, schema } = await import("@/server/db");
      const { getPreferences } = await import("@/server/modules/settings/settings");
      const student = await createUser({ role: "student" });
      await db.insert(schema.userSettings).values({
        userId: student.id,
        language: "xx",
        difficulty: "insane",
        tutorPersonality: "villain",
        hobbies: ["chess"],
      });
      expect(await getPreferences(contextFor(student), "en")).toMatchObject({
        language: "en",
        difficulty: "medium",
        tutorPersonality: "friend",
        hobbies: ["chess"],
      });
    });
  });

  describe("two-step verification status", () => {
    it("is required for every role, students included", async () => {
      const { getTwoFactorStatus } = await import("@/server/modules/settings/settings");
      const admin = await createUser({ role: "admin", twoFactorEnabled: true });
      const student = await createUser({ role: "student" });
      expect(await getTwoFactorStatus(contextFor(admin))).toEqual({ enabled: true, required: true, pending: false });
      expect(await getTwoFactorStatus(contextFor(student))).toEqual({ enabled: false, required: true, pending: false });
    });

    it("reports an enrollment that was started but never verified", async () => {
      const { db, schema } = await import("@/server/db");
      const { getTwoFactorStatus } = await import("@/server/modules/settings/settings");
      const teacher = await createUser({ role: "teacher" });
      await db.insert(schema.twoFactors).values({
        id: crypto.randomUUID(),
        userId: teacher.id,
        secret: "encrypted",
        backupCodes: "encrypted",
        verified: false,
      });
      expect(await getTwoFactorStatus(contextFor(teacher))).toEqual({ enabled: false, required: true, pending: true });
    });
  });

  describe("sessions", () => {
    it("lists only the caller's unexpired sessions, current first, without tokens", async () => {
      const { listSessions } = await import("@/server/modules/settings/settings");
      const user = await createUser({ role: "teacher" });
      const stranger = await createUser({ role: "teacher" });
      const current = await addSession(user.id, { updatedAt: new Date(Date.now() - 3 * HOUR) });
      const recent = await addSession(user.id, { updatedAt: new Date() });
      await addSession(user.id, { expiresAt: new Date(Date.now() - HOUR) });
      await addSession(stranger.id);

      const sessions = await listSessions(contextFor(user, current));
      expect(sessions.map((session) => session.id)).toEqual([current, recent]);
      expect(sessions[0].current).toBe(true);
      expect(sessions[1].current).toBe(false);
      for (const session of sessions) {
        expect(Object.keys(session).sort()).toEqual(
          ["createdAt", "current", "id", "ipAddress", "lastActiveAt", "userAgent"].sort(),
        );
      }
    });

    it("signs out one of the caller's other devices", async () => {
      const { revokeSession } = await import("@/server/modules/settings/settings");
      const user = await createUser({ role: "student" });
      const current = await addSession(user.id);
      const other = await addSession(user.id);
      await revokeSession(contextFor(user, current), other);
      expect(await sessionExists(other)).toBe(false);
      expect(await sessionExists(current)).toBe(true);
    });

    it("cannot sign out another user's session (looks like a missing one)", async () => {
      const { revokeSession } = await import("@/server/modules/settings/settings");
      const attacker = await createUser({ role: "student" });
      const victim = await createUser({ role: "admin", twoFactorEnabled: true });
      const attackerSession = await addSession(attacker.id);
      const victimSession = await addSession(victim.id);
      await expect(revokeSession(contextFor(attacker, attackerSession), victimSession)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(await sessionExists(victimSession)).toBe(true);
    });

    it("refuses to revoke the current session (sign out is used for that)", async () => {
      const { revokeSession } = await import("@/server/modules/settings/settings");
      const user = await createUser({ role: "student" });
      const current = await addSession(user.id);
      await expect(revokeSession(contextFor(user, current), current)).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await sessionExists(current)).toBe(true);
    });

    it("signs out every other device of the caller only", async () => {
      const { revokeOtherSessions } = await import("@/server/modules/settings/settings");
      const user = await createUser({ role: "manager", twoFactorEnabled: true });
      const neighbour = await createUser({ role: "manager", twoFactorEnabled: true });
      const current = await addSession(user.id);
      const others = [await addSession(user.id), await addSession(user.id)];
      const neighbourSession = await addSession(neighbour.id);

      expect(await revokeOtherSessions(contextFor(user, current))).toBe(2);
      expect(await sessionExists(current)).toBe(true);
      for (const id of others) expect(await sessionExists(id)).toBe(false);
      expect(await sessionExists(neighbourSession)).toBe(true);
      expect(await revokeOtherSessions(contextFor(user, current))).toBe(0);
    });

    it("validates session ids", async () => {
      const { revokeSessionSchema } = await import("@/server/modules/settings/settings");
      expect(revokeSessionSchema.safeParse({ sessionId: crypto.randomUUID() }).success).toBe(true);
      expect(revokeSessionSchema.safeParse({ sessionId: "1 OR 1=1" }).success).toBe(false);
    });
  });
});
