import type { SessionContext } from "@/server/auth/session";
import type { Role } from "@/server/policy/roles";

// Shared builders for service-level API tests. Services take a SessionContext (or its
// actor) directly, so most tests never go through sign-in. Use unique names per test
// file; resetDatabase() in beforeAll gives every file a clean database.

export async function createSchool(name = "Test School", branch: string | null = null) {
  const { db, schema } = await import("@/server/db");
  const id = crypto.randomUUID();
  await db.insert(schema.schools).values({ id, name, branch });
  return { id, name };
}

export interface TestUserInput {
  role: Role;
  schoolId?: string | null;
  grade?: string | null;
  section?: string | null;
  subject?: string | null;
  name?: string;
  isActive?: boolean;
  twoFactorEnabled?: boolean;
}

/** Inserts a user row without a password (cannot sign in). Fast: no hashing. */
export async function createUser(input: TestUserInput) {
  const { db, schema } = await import("@/server/db");
  const id = crypto.randomUUID();
  const name = input.name ?? `${input.role}-${id.slice(0, 8)}`;
  const email = `${input.role}.${id.slice(0, 8)}@school.test`;
  await db.insert(schema.users).values({
    id,
    name,
    email,
    emailVerified: true,
    role: input.role,
    schoolId: input.schoolId ?? null,
    grade: input.grade ?? null,
    section: input.section ?? null,
    subject: input.subject ?? null,
    isActive: input.isActive ?? true,
    mustChangePassword: false,
    twoFactorEnabled: input.twoFactorEnabled ?? false,
  });
  return { id, name, email, ...input };
}

/** A SessionContext as requireSession() would return it, for calling services directly. */
export function contextFor(
  user: Awaited<ReturnType<typeof createUser>>,
  sessionId = crypto.randomUUID(),
): SessionContext {
  return {
    sessionId,
    actor: {
      id: user.id,
      role: user.role,
      schoolId: user.schoolId ?? null,
      grade: user.grade ?? null,
      section: user.section ?? null,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: null,
      role: user.role,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      mustChangePassword: false,
    },
  };
}
