// Development seed: one school with two classes and one account per role, with random
// passwords. Privileged accounts get an authenticator enrolled through the real Better
// Auth endpoints (sign in → enable → verify), so they behave exactly like real accounts.
//
// Writes the credentials and otpauth URIs to .dev-accounts.local.json (git-ignored) and
// prints only that path. Re-running resets the same seed accounts (new passwords, new
// authenticator secrets, signed out everywhere). Refuses to touch a non-local database.
//
// Usage: npm run seed:dev
import { createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { auth } from "@/server/auth/auth";
import { clearLoginThrottles } from "@/server/auth/throttle";
import { closeDb, db, schema } from "@/server/db";
import { requiresTwoFactor, type Role } from "@/server/policy/roles";
import { createAccount, generatePassword } from "@/server/services/accounts";

const OUTPUT = resolve(process.cwd(), ".dev-accounts.local.json");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const SCHOOL_NAME = "Seed Demo School";
const CLASSES = [
  { grade: "7", section: "A" },
  { grade: "8", section: "B" },
] as const;
const SUBJECT = "Mathematics";

interface SeedUser {
  key: string;
  role: Role;
  name: string;
  inSchool: boolean;
  grade?: string;
  section?: string;
  subject?: string;
}

const SEED_USERS: SeedUser[] = [
  { key: "owner", role: "owner", name: "Seed Owner", inSchool: false },
  { key: "manager", role: "manager", name: "Seed Manager", inSchool: false },
  { key: "admin", role: "admin", name: "Seed Admin", inSchool: true },
  { key: "teacher", role: "teacher", name: "Seed Teacher", inSchool: true, subject: SUBJECT },
  { key: "student1", role: "student", name: "Seed Student One", inSchool: true, ...CLASSES[0] },
  { key: "student2", role: "student", name: "Seed Student Two", inSchool: true, ...CLASSES[1] },
];

function assertLocalDatabase() {
  if (env.NODE_ENV === "production") throw new Error("seed:dev never runs with NODE_ENV=production.");
  const host = new URL(env.DATABASE_URL).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`seed:dev only runs against a local database (DATABASE_URL host is "${host}").`);
  }
}

/** A tiny cookie-keeping client for the Better Auth handler (no HTTP server needed). */
class AuthSession {
  private cookies = new Map<string, string>();

  async call(path: string, body: unknown): Promise<Record<string, unknown>> {
    const response = await auth.handler(
      new Request(`${env.BETTER_AUTH_URL}/api/auth${path}`, {
        method: "POST",
        headers: {
          origin: env.BETTER_AUTH_URL,
          "content-type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "),
        },
        body: JSON.stringify(body),
      }),
    );
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const index = pair.indexOf("=");
      this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
    const text = await response.text();
    if (!response.ok) throw new Error(`${path} failed (${response.status}): ${text}`);
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  }
}

// RFC 6238 (SHA-1, 6 digits, 30 s), as authenticator apps compute it.
function totp(otpauthUri: string): string {
  const secret = new URL(otpauthUri).searchParams.get("secret") ?? "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "").toUpperCase()]
    .map((char) => alphabet.indexOf(char).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

async function ensureSchool(): Promise<string> {
  const [existing] = await db
    .select({ id: schema.schools.id })
    .from(schema.schools)
    .where(eq(schema.schools.name, SCHOOL_NAME))
    .limit(1);
  const schoolId = existing?.id ?? crypto.randomUUID();
  if (!existing) await db.insert(schema.schools).values({ id: schoolId, name: SCHOOL_NAME, setupCompleted: true });
  for (const { grade, section } of CLASSES) {
    await db
      .insert(schema.schoolClasses)
      .values({ id: crypto.randomUUID(), schoolId, grade, section })
      .onDuplicateKeyUpdate({ set: { grade } });
  }
  return schoolId;
}

/** Creates the account, or resets an existing one to a known clean state. */
async function upsertUser(user: SeedUser, email: string, schoolId: string, password: string): Promise<string> {
  const profile = {
    name: user.name,
    role: user.role,
    schoolId: user.inSchool ? schoolId : null,
    grade: user.grade ?? null,
    section: user.section ?? null,
    subject: user.subject ?? null,
  };
  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(email);
  let userId: string;
  if (existing) {
    userId = existing.user.id;
    await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password));
    await db.delete(schema.twoFactors).where(eq(schema.twoFactors.userId, userId));
    await ctx.internalAdapter.deleteUserSessions(userId);
    await clearLoginThrottles(email);
  } else {
    userId = (await createAccount({ email, ...profile }, password)).id;
  }
  await db
    .update(schema.users)
    .set({ ...profile, isActive: true, mustChangePassword: false, twoFactorEnabled: false })
    .where(eq(schema.users.id, userId));
  return userId;
}

/** Enrolls TOTP through the real endpoints and returns the otpauth URI and backup codes. */
async function enrollTwoFactor(email: string, password: string) {
  const session = new AuthSession();
  await session.call("/sign-in/email", { email, password });
  const enabled = await session.call("/two-factor/enable", { password });
  const totpURI = String(enabled.totpURI);
  await session.call("/two-factor/verify-totp", { code: totp(totpURI) });
  await session.call("/sign-out", {});
  return { totpURI, backupCodes: enabled.backupCodes as string[] };
}

async function main() {
  assertLocalDatabase();
  const schoolId = await ensureSchool();
  const accounts: Record<string, unknown> = {};

  for (const user of SEED_USERS) {
    const email = `seed.${user.key}@${env.ALLOWED_EMAIL_DOMAIN}`;
    const password = generatePassword(16);
    const userId = await upsertUser(user, email, schoolId, password);

    if (user.role === "teacher") {
      for (const { grade, section } of CLASSES) {
        await db
          .insert(schema.teacherAssignments)
          .values({ id: crypto.randomUUID(), teacherId: userId, schoolId, grade, section, subject: SUBJECT })
          .onDuplicateKeyUpdate({ set: { schoolId } });
      }
    }

    const twoFactor = requiresTwoFactor(user.role) ? await enrollTwoFactor(email, password) : null;
    accounts[user.key] = { role: user.role, email, password, ...(twoFactor ?? {}) };
  }

  await writeFile(
    OUTPUT,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), school: SCHOOL_NAME, accounts }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(`Seed accounts written to ${OUTPUT}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
