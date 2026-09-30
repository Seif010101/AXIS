import "server-only";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { auth } from "@/server/auth/auth";
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

export function isAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${env.ALLOWED_EMAIL_DOMAIN.toLowerCase()}`);
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
    throw new AppError("VALIDATION", `Email must end with @${env.ALLOWED_EMAIL_DOMAIN}`);
  }

  const ctx = await auth.$context;
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    throw new AppError("CONFLICT", "An account with this email already exists");
  }

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
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(password),
  });
  return { id: user.id, email, password };
}

/**
 * Replaces a user's password with a new temporary one, signs them out everywhere and
 * forces a change on next login. The caller must have checked policy and step-up.
 */
export async function resetPassword(userId: string): Promise<string> {
  const password = generatePassword();
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password));
  await db.update(users).set({ mustChangePassword: true }).where(eq(users.id, userId));
  await ctx.internalAdapter.deleteUserSessions(userId);
  return password;
}

/** Deactivating also deletes the user's sessions, so they are signed out immediately. */
export async function setAccountActive(userId: string, isActive: boolean): Promise<void> {
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
  if (!isActive) {
    const ctx = await auth.$context;
    await ctx.internalAdapter.deleteUserSessions(userId);
  }
}
