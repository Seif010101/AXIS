import "server-only";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import { auth } from "@/server/auth/auth";
import { clearLoginThrottles } from "@/server/auth/throttle";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import type { Role } from "@/server/policy/roles";

// Unambiguous characters only (no 0/O, 1/l/I): these passwords are printed and typed by hand.
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Cryptographically random temporary password (the legacy generator was not a CSPRNG). */
export function generatePassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

// Same rule Better Auth applies at sign-in, so we never create an account that can't log in.
const emailSchema = z.email();

export function isAllowedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return (
    emailSchema.safeParse(normalized).success &&
    normalized.endsWith(`@${env.ALLOWED_EMAIL_DOMAIN.toLowerCase()}`)
  );
}

export interface NewAccount {
  email: string;
  name: string;
  role: Role;
  schoolId?: string | null;
  grade?: string | null;
  section?: string | null;
  subject?: string | null;
  ministryId?: string | null;
}

export interface CreatedAccount {
  id: string;
  email: string;
  /** Shown to the creator exactly once. Only its hash is stored. */
  password: string;
}

const isDuplicateKey = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { errno?: number }).errno === 1062;

/**
 * Creates a user with a temporary password. Public sign-up is disabled, so this is the
 * only way accounts come into existence. The user must change the password on first login.
 */
export async function createAccount(
  input: NewAccount,
  password: string = generatePassword(),
): Promise<CreatedAccount> {
  const email = input.email.trim().toLowerCase();
  if (!isAllowedEmail(email)) {
    throw new AppError(
      "VALIDATION",
      `Email must be a valid address ending with @${env.ALLOWED_EMAIL_DOMAIN}`,
    );
  }

  const ctx = await auth.$context;
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    throw new AppError("CONFLICT", "An account with this email already exists");
  }
  // Hash before creating anything, so a hashing failure can't leave a half-made account.
  const passwordHash = await ctx.password.hash(password);

  let userId: string;
  try {
    const user = await ctx.internalAdapter.createUser(
      {
        email,
        name: input.name.trim(),
        emailVerified: true,
        role: input.role,
        schoolId: input.schoolId ?? null,
        grade: input.grade ?? null,
        section: input.section ?? null,
        subject: input.subject ?? null,
        ministryId: input.ministryId ?? null,
        isActive: true,
        mustChangePassword: true,
      },
      { method: "admin" },
    );
    userId = user.id;
  } catch (error) {
    // Two concurrent creations of the same email: the loser hits the unique index.
    if (isDuplicateKey(error)) throw new AppError("CONFLICT", "An account with this email already exists");
    throw error;
  }

  try {
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: passwordHash,
    });
  } catch (error) {
    // A user without a credential account could never sign in or be re-created.
    await ctx.internalAdapter.deleteUser(userId).catch(() => {});
    throw error;
  }
  return { id: userId, email, password };
}

/**
 * Replaces a user's password with a new temporary one, signs them out everywhere, clears
 * any sign-in lockout and forces a change on next login. The caller must have checked
 * policy and step-up.
 */
export async function resetPassword(userId: string): Promise<string> {
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  const password = generatePassword();
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(password);
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  if (accounts.some((a) => a.providerId === "credential")) {
    await ctx.internalAdapter.updatePassword(userId, passwordHash);
  } else {
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: passwordHash,
    });
  }
  await db.update(users).set({ mustChangePassword: true }).where(eq(users.id, userId));
  await ctx.internalAdapter.deleteUserSessions(userId);
  await clearLoginThrottles(user.email);
  return password;
}

/** Deactivating also deletes the user's sessions, so they are signed out immediately. */
export async function setAccountActive(userId: string, isActive: boolean): Promise<void> {
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  await db.update(users).set({ isActive }).where(eq(users.id, userId));
  const ctx = await auth.$context;
  if (isActive) {
    // Sign-in attempts made while disabled shouldn't keep the account locked.
    await clearLoginThrottles(user.email);
  } else {
    await ctx.internalAdapter.deleteUserSessions(userId);
  }
}
