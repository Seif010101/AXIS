import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, like, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { brand } from "@/config/brand";
import { env } from "@/env";
import type { SessionContext } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { isDuplicateKeyError } from "@/server/db/errors";
import { AppError } from "@/server/errors";
import type { Role } from "@/server/policy/roles";
import { assertCanManageUser, schoolScope } from "@/server/policy/scope";
import { createAccount, resetPassword, setAccountActive } from "@/server/services/accounts";
import { deletePrivateEvents } from "@/server/services/privacy";
import { effectiveStreak } from "@/server/services/stars";
import { resolveSchool } from "./access";
import { consumeRate, recordAudit } from "./audit";
import { matchClass } from "./classes";
import { clean, cleanOrNull, emailCandidates, escapeLike, type AccountRole } from "./naming";

const { users, schools, teacherAssignments } = schema;

export const PEOPLE_PAGE_SIZE = 50;
const EXPORT_LIMIT = 10_000;

// ---------------------------------------------------------------------------
// Who may see and create which roles.

const CREATABLE: Record<Role, readonly AccountRole[]> = {
  owner: ["manager", "admin", "teacher", "student"],
  manager: ["admin", "teacher", "student"],
  admin: ["teacher", "student"],
  teacher: [],
  student: [],
};

export function creatableRoles(role: Role): readonly AccountRole[] {
  return CREATABLE[role];
}

/** Roles listed on a school's people page for this actor. */
function visibleSchoolRoles(ctx: SessionContext): AccountRole[] {
  return ctx.actor.role === "admin" ? ["teacher", "student"] : ["admin", "teacher", "student"];
}

// ---------------------------------------------------------------------------
// Listing

export const peopleFiltersSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  role: z.enum(["all", "manager", "admin", "teacher", "student"]).catch("all"),
  grade: z.string().max(50).optional().catch(undefined),
  section: z.string().max(50).optional().catch(undefined),
  status: z.enum(["all", "active", "inactive", "pending"]).catch("all"),
  /** Owner directory only: a school id, or "none" for accounts without a school. */
  school: z.string().max(40).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
});

export type PeopleFilters = z.output<typeof peopleFiltersSchema>;

export type PeopleScope = { kind: "school"; schoolId?: string } | { kind: "directory" };

export interface PersonRow {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  schoolId: string | null;
  schoolName: string | null;
  schoolBranch: string | null;
  grade: string | null;
  section: string | null;
  subject: string | null;
  ministryId: string | null;
  isActive: boolean;
  /** Has an authenticator linked (staff can reset it when the phone is lost). */
  twoFactorEnabled: boolean;
  /** Never signed in with the temporary password yet. */
  pending: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  stars: number;
  streak: number;
  assignments: { id: string; grade: string; section: string; subject: string }[];
}

const pendingCondition = and(isNull(users.lastLoginAt), eq(users.mustChangePassword, true));

async function scopeConditions(
  ctx: SessionContext,
  scope: PeopleScope,
): Promise<{ base: SQL; schoolId: string | null }> {
  if (scope.kind === "directory") {
    if (ctx.actor.role !== "owner") throw new AppError("FORBIDDEN", "Only the owner can list every user");
    return { base: ne(users.role, "owner"), schoolId: null };
  }
  const schoolId = await resolveSchool(ctx, scope.schoolId);
  return {
    base: and(eq(users.schoolId, schoolId), inArray(users.role, visibleSchoolRoles(ctx)))!,
    schoolId,
  };
}

function filterConditions(filters: PeopleFilters, scope: PeopleScope): SQL[] {
  const conditions: SQL[] = [];
  const q = clean(filters.q ?? "");
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    conditions.push(
      or(like(users.name, pattern), like(users.email, pattern), like(users.ministryId, pattern))!,
    );
  }
  if (filters.role !== "all") conditions.push(eq(users.role, filters.role));
  if (filters.grade) conditions.push(eq(users.grade, filters.grade));
  if (filters.section) conditions.push(eq(users.section, filters.section));
  if (filters.status === "active") conditions.push(eq(users.isActive, true));
  if (filters.status === "inactive") conditions.push(eq(users.isActive, false));
  if (filters.status === "pending") conditions.push(pendingCondition!);
  if (scope.kind === "directory" && filters.school) {
    if (filters.school === "none") conditions.push(isNull(users.schoolId));
    else if (z.uuid().safeParse(filters.school).success) conditions.push(eq(users.schoolId, filters.school));
  }
  return conditions;
}

const personColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  schoolId: users.schoolId,
  schoolName: schools.name,
  schoolBranch: schools.branch,
  grade: users.grade,
  section: users.section,
  subject: users.subject,
  ministryId: users.ministryId,
  isActive: users.isActive,
  twoFactorEnabled: users.twoFactorEnabled,
  mustChangePassword: users.mustChangePassword,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  stars: users.starsCount,
  currentStreak: users.currentStreak,
  lastStreakDay: users.lastStreakDay,
};

function peopleQuery() {
  return db.select(personColumns).from(users).leftJoin(schools, eq(users.schoolId, schools.id)).$dynamic();
}

type RawPerson = Awaited<ReturnType<typeof peopleQuery>>[number];

async function toRows(raw: RawPerson[]): Promise<PersonRow[]> {
  const teacherIds = raw.filter((r) => r.role === "teacher").map((r) => r.id);
  const assignments = teacherIds.length
    ? await db
        .select()
        .from(teacherAssignments)
        .where(inArray(teacherAssignments.teacherId, teacherIds))
        .orderBy(asc(teacherAssignments.grade), asc(teacherAssignments.section))
    : [];
  return raw.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role as AccountRole,
    schoolId: r.schoolId,
    schoolName: r.schoolName,
    schoolBranch: r.schoolBranch,
    grade: r.grade,
    section: r.section,
    subject: r.subject,
    ministryId: r.ministryId,
    isActive: r.isActive,
    twoFactorEnabled: r.twoFactorEnabled,
    pending: r.lastLoginAt === null && r.mustChangePassword,
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
    stars: r.stars,
    streak: effectiveStreak(r.currentStreak, r.lastStreakDay),
    assignments: assignments
      .filter((a) => a.teacherId === r.id)
      .map((a) => ({ id: a.id, grade: a.grade, section: a.section, subject: a.subject })),
  }));
}

// Admins first, then teachers, then students; managers lead in the owner directory.
const roleOrder = sql`FIELD(${users.role}, 'manager', 'admin', 'teacher', 'student')`;

export async function listPeople(
  ctx: SessionContext,
  scope: PeopleScope,
  filters: PeopleFilters,
): Promise<{
  rows: PersonRow[];
  total: number;
  page: number;
  pageCount: number;
  roleCounts: Partial<Record<AccountRole, number>>;
}> {
  const { base } = await scopeConditions(ctx, scope);
  const where = and(base, ...filterConditions(filters, scope));
  const [{ total }] = await db.select({ total: count() }).from(users).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PEOPLE_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const raw = await peopleQuery()
    .where(where)
    .orderBy(scope.kind === "directory" ? desc(users.createdAt) : roleOrder, asc(users.name))
    .limit(PEOPLE_PAGE_SIZE)
    .offset((page - 1) * PEOPLE_PAGE_SIZE);
  const counts = await db
    .select({ role: users.role, n: count() })
    .from(users)
    .where(base)
    .groupBy(users.role);
  return {
    rows: await toRows(raw),
    total,
    page,
    pageCount,
    roleCounts: Object.fromEntries(counts.map((c) => [c.role, c.n])),
  };
}

/** The filtered list without paging (CSV export). Never includes secrets. */
export async function exportPeople(
  ctx: SessionContext,
  scope: PeopleScope,
  filters: PeopleFilters,
): Promise<PersonRow[]> {
  const { base } = await scopeConditions(ctx, scope);
  const raw = await peopleQuery()
    .where(and(base, ...filterConditions(filters, scope)))
    .orderBy(roleOrder, asc(users.name))
    .limit(EXPORT_LIMIT);
  return toRows(raw);
}

// ---------------------------------------------------------------------------
// Loading one manageable account

interface Target {
  id: string;
  name: string;
  email: string;
  role: Role;
  schoolId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  grade: string | null;
  section: string | null;
}

/**
 * Loads an account the actor may manage. Accounts outside the actor's reach (another
 * school, unknown id) are NOT_FOUND; known but protected ones (self, a peer, a superior)
 * are FORBIDDEN.
 */
async function loadManageable(ctx: SessionContext, userId: string): Promise<Target> {
  const [target] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      schoolId: users.schoolId,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      grade: users.grade,
      section: users.section,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) throw new AppError("NOT_FOUND", "Account not found");
  const scope = schoolScope(ctx.actor);
  if (scope.kind === "school" && target.schoolId !== scope.schoolId)
    throw new AppError("NOT_FOUND", "Account not found");
  assertCanManageUser(ctx.actor, { id: target.id, role: target.role as Role, schoolId: target.schoolId });
  return target as Target;
}

// ---------------------------------------------------------------------------
// Creating accounts

export const personFieldsSchema = z.object({
  name: z.string().transform(clean).pipe(z.string().min(2).max(255)),
  ministryId: z
    .string()
    .max(100)
    .optional()
    .transform((v) => cleanOrNull(v))
    .pipe(
      z
        .string()
        .max(50)
        .regex(/^[\p{L}\p{N}._-]+$/u)
        .nullable(),
    ),
  grade: z
    .string()
    .max(100)
    .optional()
    .transform((v) => cleanOrNull(v)),
  section: z
    .string()
    .max(100)
    .optional()
    .transform((v) => cleanOrNull(v)),
  subject: z
    .string()
    .max(200)
    .optional()
    .transform((v) => cleanOrNull(v))
    .pipe(z.string().max(100).nullable()),
});

export const createPersonSchema = personFieldsSchema.extend({
  role: z.enum(["manager", "admin", "teacher", "student"]),
  schoolId: z.uuid().optional(),
});

export interface Credentials {
  userId: string;
  name: string;
  email: string;
  role: AccountRole;
  grade: string | null;
  section: string | null;
  password: string;
}

/** Picks the first free generated email local part and creates the account (retrying races). */
async function createWithGeneratedEmail(
  role: AccountRole,
  fields: {
    name: string;
    ministryId: string | null;
    schoolId: string | null;
    grade: string | null;
    section: string | null;
    subject: string | null;
  },
): Promise<{ id: string; email: string; password: string }> {
  const domain = env.ALLOWED_EMAIL_DOMAIN.toLowerCase();
  let start = 1;
  if (!fields.ministryId) {
    // Continue after the highest number already used for this role.
    const prefix = `${brand.name.toLowerCase()}.${role}`;
    const [row] = await db
      .select({ n: count() })
      .from(users)
      .where(like(users.email, `${escapeLike(prefix)}%@${escapeLike(domain)}`));
    start = row.n + 1;
  }
  const candidates = emailCandidates(brand.name, role, fields.ministryId, start, 40).map(
    (local) => `${local}@${domain}`,
  );
  const taken = new Set(
    (await db.select({ email: users.email }).from(users).where(inArray(users.email, candidates))).map(
      (r) => r.email,
    ),
  );
  let attempts = 0;
  for (const email of candidates) {
    if (taken.has(email)) continue;
    try {
      const created = await createAccount({ email, role, ...fields });
      return { id: created.id, email: created.email, password: created.password };
    } catch (error) {
      if (error instanceof AppError && error.code === "CONFLICT" && ++attempts < 5) continue;
      throw error;
    }
  }
  throw new AppError("CONFLICT", "No free email address could be generated", { reason: "email_taken" });
}

async function assertMinistryIdFree(
  schoolId: string | null,
  role: AccountRole,
  ministryId: string | null,
  exceptId?: string,
) {
  if (!ministryId) return;
  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        schoolId ? eq(users.schoolId, schoolId) : isNull(users.schoolId),
        eq(users.role, role),
        eq(users.ministryId, ministryId),
        ...(exceptId ? [ne(users.id, exceptId)] : []),
      ),
    )
    .limit(1);
  if (clash) throw new AppError("CONFLICT", "This ministry ID is already used", { field: "ministryId" });
}

/** Resolves a student's class to the stored spelling; the class must exist in the school. */
async function studentClass(schoolId: string, grade: string | null, section: string | null) {
  if (!grade) throw new AppError("VALIDATION", "A grade is required for students", { field: "grade" });
  const match = await matchClass(schoolId, grade, section ?? "");
  if (!match) throw new AppError("VALIDATION", "This class does not exist in the school", { field: "grade" });
  return { grade: match.grade, section: match.section || null };
}

export async function createPerson(
  ctx: SessionContext,
  input: z.output<typeof createPersonSchema>,
): Promise<Credentials> {
  if (!CREATABLE[ctx.actor.role].includes(input.role)) {
    throw new AppError("FORBIDDEN", `A ${ctx.actor.role} cannot create a ${input.role}`);
  }
  const schoolId = input.role === "manager" ? null : await resolveSchool(ctx, input.schoolId);
  await consumeRate(ctx, "mintPassword");
  await assertMinistryIdFree(schoolId, input.role, input.ministryId);

  let grade: string | null = null;
  let section: string | null = null;
  let assignment: { grade: string; section: string } | null = null;
  if (input.role === "student")
    ({ grade, section } = await studentClass(schoolId!, input.grade, input.section));
  if (input.role === "teacher" && input.grade) {
    assignment = await matchClass(schoolId!, input.grade, input.section ?? "");
    if (!assignment)
      throw new AppError("VALIDATION", "This class does not exist in the school", { field: "grade" });
  }

  const created = await createWithGeneratedEmail(input.role, {
    name: input.name,
    ministryId: input.ministryId,
    schoolId,
    grade,
    section,
    subject: input.role === "teacher" ? input.subject : null,
  });
  if (assignment) {
    await db.insert(teacherAssignments).values({
      teacherId: created.id,
      schoolId: schoolId!,
      grade: assignment.grade,
      section: assignment.section,
      subject: input.subject ?? "",
    });
  }
  await recordAudit(ctx, "account_created", {
    schoolId,
    targetId: created.id,
    targetEmail: created.email,
    targetRole: input.role,
  });
  return {
    userId: created.id,
    name: input.name,
    email: created.email,
    role: input.role,
    grade,
    section,
    password: created.password,
  };
}

// ---------------------------------------------------------------------------
// Editing, passwords, activation, deletion

export const updatePersonSchema = personFieldsSchema.extend({ userId: z.uuid() });

export async function updatePerson(
  ctx: SessionContext,
  input: z.output<typeof updatePersonSchema>,
): Promise<void> {
  const target = await loadManageable(ctx, input.userId);
  const role = target.role as AccountRole;
  await assertMinistryIdFree(target.schoolId, role, input.ministryId, target.id);
  const changes: Partial<typeof users.$inferInsert> = { name: input.name, ministryId: input.ministryId };
  if (role === "student" && target.schoolId)
    Object.assign(changes, await studentClass(target.schoolId, input.grade, input.section));
  if (role === "teacher") changes.subject = input.subject;
  await db.update(users).set(changes).where(eq(users.id, target.id));
  await recordAudit(ctx, "account_updated", {
    schoolId: target.schoolId,
    targetId: target.id,
    fields: Object.keys(changes),
  });
}

function credentialsOf(target: Target, password: string): Credentials {
  return {
    userId: target.id,
    name: target.name,
    email: target.email,
    role: target.role as AccountRole,
    grade: target.grade,
    section: target.section,
    password,
  };
}

/** New temporary password, shown once; signs the user out everywhere. */
export async function resetPersonPassword(ctx: SessionContext, userId: string): Promise<Credentials> {
  const target = await loadManageable(ctx, userId);
  await consumeRate(ctx, "mintPassword");
  const password = await resetPassword(target.id);
  await recordAudit(ctx, "password_reset", {
    schoolId: target.schoolId,
    targetId: target.id,
    targetEmail: target.email,
  });
  return credentialsOf(target, password);
}

/**
 * Removes the account's authenticator (a lost or replaced phone). The user is signed out
 * everywhere; at the next sign-in with the password they must link an authenticator
 * again before anything else works. The caller has passed step-up.
 */
export async function resetPersonTwoFactor(ctx: SessionContext, userId: string): Promise<void> {
  const target = await loadManageable(ctx, userId);
  await consumeRate(ctx, "resetTwoFactor");
  await db.transaction(async (tx) => {
    await tx.delete(schema.twoFactors).where(eq(schema.twoFactors.userId, target.id));
    await tx.update(users).set({ twoFactorEnabled: false }).where(eq(users.id, target.id));
    // Step-up grants cascade with the sessions.
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, target.id));
    await recordAudit(
      ctx,
      "two_factor_reset",
      { schoolId: target.schoolId, targetId: target.id, targetEmail: target.email },
      tx,
    );
  });
}

export const reissueSchema = z.object({ userIds: z.array(z.uuid()).min(1).max(200) });

/** New passwords for accounts that never signed in (a lost credentials sheet). */
export async function reissueCredentials(
  ctx: SessionContext,
  userIds: readonly string[],
): Promise<Credentials[]> {
  const targets: Target[] = [];
  for (const id of new Set(userIds)) {
    const target = await loadManageable(ctx, id);
    if (target.isActive && target.lastLoginAt === null && target.mustChangePassword) targets.push(target);
  }
  if (targets.length === 0)
    throw new AppError("VALIDATION", "None of these accounts is waiting for a first sign-in", {
      reason: "none_pending",
    });
  await consumeRate(ctx, "mintPassword", targets.length);
  const result: Credentials[] = [];
  for (const target of targets) result.push(credentialsOf(target, await resetPassword(target.id)));
  await recordAudit(ctx, "credentials_reissued", {
    schoolId: targets[0].schoolId,
    targetIds: targets.map((t) => t.id),
  });
  return result;
}

export const setActiveSchema = z.object({ userId: z.uuid(), isActive: z.boolean() });

export async function setPersonActive(ctx: SessionContext, userId: string, isActive: boolean): Promise<void> {
  const target = await loadManageable(ctx, userId);
  if (target.isActive === isActive) return;
  await setAccountActive(target.id, isActive);
  await recordAudit(ctx, isActive ? "account_activated" : "account_deactivated", {
    schoolId: target.schoolId,
    targetId: target.id,
    targetEmail: target.email,
  });
}

export interface PersonImpact {
  role: AccountRole;
  authored: { homework: number; tests: number; worksheets: number };
  submissions: number;
  testResults: number;
  conversations: number;
}

export async function personDeletionImpact(ctx: SessionContext, userId: string): Promise<PersonImpact> {
  const target = await loadManageable(ctx, userId);
  const n = async (query: Promise<{ n: number }[]>) => (await query)[0]?.n ?? 0;
  return {
    role: target.role as AccountRole,
    authored: {
      homework: await n(
        db.select({ n: count() }).from(schema.homework).where(eq(schema.homework.teacherId, target.id)),
      ),
      tests: await n(
        db.select({ n: count() }).from(schema.tests).where(eq(schema.tests.teacherId, target.id)),
      ),
      worksheets: await n(
        db.select({ n: count() }).from(schema.worksheets).where(eq(schema.worksheets.teacherId, target.id)),
      ),
    },
    submissions: await n(
      db
        .select({ n: count() })
        .from(schema.homeworkSubmissions)
        .where(eq(schema.homeworkSubmissions.studentId, target.id)),
    ),
    testResults: await n(
      db.select({ n: count() }).from(schema.testResults).where(eq(schema.testResults.studentId, target.id)),
    ),
    conversations: await n(
      db
        .select({ n: count() })
        .from(schema.aiConversations)
        .where(eq(schema.aiConversations.userId, target.id)),
    ),
  };
}

/** Permanent deletion: managers and the owner only (school admins deactivate instead). */
export async function deletePerson(ctx: SessionContext, userId: string): Promise<void> {
  if (schoolScope(ctx.actor).kind !== "all")
    throw new AppError("FORBIDDEN", "Only managers can delete accounts");
  const target = await loadManageable(ctx, userId);
  const impact = await personDeletionImpact(ctx, userId);
  const authored = impact.authored.homework + impact.authored.tests + impact.authored.worksheets;
  if (authored > 0)
    throw new AppError("CONFLICT", "This teacher authored content; deactivate instead", {
      reason: "authored_content",
    });
  await consumeRate(ctx, "deleteAccount");
  await db.transaction(async (tx) => {
    await deletePrivateEvents(tx, [target.id]);
    await tx.delete(users).where(eq(users.id, target.id));
    await recordAudit(
      ctx,
      "account_deleted",
      {
        schoolId: target.schoolId,
        targetId: target.id,
        targetEmail: target.email,
        targetName: target.name,
        targetRole: target.role,
      },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Teacher assignments

export const assignmentSchema = z.object({
  teacherId: z.uuid(),
  grade: z.string().min(1).max(50),
  section: z.string().max(50).default(""),
  subject: z
    .string()
    .max(200)
    .optional()
    .transform((v) => clean(v ?? ""))
    .pipe(z.string().max(100)),
});

async function loadTeacher(ctx: SessionContext, teacherId: string): Promise<Target & { schoolId: string }> {
  const target = await loadManageable(ctx, teacherId);
  if (target.role !== "teacher" || !target.schoolId) throw new AppError("NOT_FOUND", "Teacher not found");
  return target as Target & { schoolId: string };
}

export async function addAssignment(
  ctx: SessionContext,
  input: z.output<typeof assignmentSchema>,
): Promise<void> {
  const teacher = await loadTeacher(ctx, input.teacherId);
  const match = await matchClass(teacher.schoolId, input.grade, input.section);
  if (!match) throw new AppError("VALIDATION", "This class does not exist in the school", { field: "grade" });
  try {
    await db.insert(teacherAssignments).values({
      teacherId: teacher.id,
      schoolId: teacher.schoolId,
      grade: match.grade,
      section: match.section,
      subject: input.subject,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new AppError("CONFLICT", "The teacher already has this class");
    throw error;
  }
}

export const removeAssignmentSchema = z.object({ teacherId: z.uuid(), assignmentId: z.uuid() });

export async function removeAssignment(
  ctx: SessionContext,
  teacherId: string,
  assignmentId: string,
): Promise<void> {
  const teacher = await loadTeacher(ctx, teacherId);
  const [result] = await db
    .delete(teacherAssignments)
    .where(and(eq(teacherAssignments.id, assignmentId), eq(teacherAssignments.teacherId, teacher.id)));
  if (result.affectedRows === 0) throw new AppError("NOT_FOUND", "Assignment not found");
}
