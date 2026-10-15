import "server-only";
import { and, asc, count, eq, inArray, like, ne, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { SessionContext } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { isDuplicateKeyError } from "@/server/db/errors";
import { AppError } from "@/server/errors";
import { schoolScope } from "@/server/policy/scope";
import { deletePrivateEvents } from "@/server/services/privacy";
import { consumeRate, recordAudit } from "./audit";
import { clean, cleanOrNull, escapeLike, foldKey } from "./naming";

const { schools, users, schoolClasses, jobs } = schema;

// Schools are managed network-wide: only the manager and the owner (policy area "manager").
function assertNetworkRole(ctx: SessionContext): void {
  if (schoolScope(ctx.actor).kind !== "all") throw new AppError("FORBIDDEN", "Only managers can manage schools");
}

export const PAGE_SIZE = 50;

export const schoolFieldsSchema = z.object({
  name: z.string().transform(clean).pipe(z.string().min(1).max(200)),
  branch: z.string().max(200).optional().transform((v) => cleanOrNull(v)).pipe(z.string().max(100).nullable()),
  ministryCode: z.string().max(200).optional().transform((v) => cleanOrNull(v)).pipe(z.string().max(50).nullable()),
});

export type SchoolFields = z.output<typeof schoolFieldsSchema>;

export const schoolListSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  status: z.enum(["all", "configured", "pending"]).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export interface SchoolRow {
  id: string;
  name: string;
  branch: string | null;
  ministryCode: string | null;
  setupCompleted: boolean;
  createdAt: Date;
  students: number;
  teachers: number;
  admins: number;
  classes: number;
}

async function countsBySchool(schoolIds: string[]) {
  const byRole = new Map<string, { students: number; teachers: number; admins: number; classes: number }>();
  for (const id of schoolIds) byRole.set(id, { students: 0, teachers: 0, admins: 0, classes: 0 });
  if (schoolIds.length === 0) return byRole;

  const people = await db
    .select({ schoolId: users.schoolId, role: users.role, n: count() })
    .from(users)
    .where(and(inArray(users.schoolId, schoolIds), inArray(users.role, ["student", "teacher", "admin"])))
    .groupBy(users.schoolId, users.role);
  for (const row of people) {
    const entry = row.schoolId ? byRole.get(row.schoolId) : undefined;
    if (!entry) continue;
    if (row.role === "student") entry.students = row.n;
    else if (row.role === "teacher") entry.teachers = row.n;
    else entry.admins = row.n;
  }
  const classes = await db
    .select({ schoolId: schoolClasses.schoolId, n: count() })
    .from(schoolClasses)
    .where(inArray(schoolClasses.schoolId, schoolIds))
    .groupBy(schoolClasses.schoolId);
  for (const row of classes) {
    const entry = byRole.get(row.schoolId);
    if (entry) entry.classes = row.n;
  }
  return byRole;
}

export async function listSchools(
  ctx: SessionContext,
  filters: z.output<typeof schoolListSchema>,
): Promise<{ rows: SchoolRow[]; total: number; page: number; pageCount: number }> {
  assertNetworkRole(ctx);
  const conditions: SQL[] = [];
  const q = clean(filters.q ?? "");
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    conditions.push(or(like(schools.name, pattern), like(schools.branch, pattern), like(schools.ministryCode, pattern))!);
  }
  if (filters.status === "configured") conditions.push(eq(schools.setupCompleted, true));
  if (filters.status === "pending") conditions.push(eq(schools.setupCompleted, false));
  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(schools).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = await db
    .select()
    .from(schools)
    .where(where)
    .orderBy(asc(schools.name), asc(schools.branch))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  const counts = await countsBySchool(rows.map((r) => r.id));
  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      branch: r.branch,
      ministryCode: r.ministryCode,
      setupCompleted: r.setupCompleted,
      createdAt: r.createdAt,
      ...counts.get(r.id)!,
    })),
    total,
    page,
    pageCount,
  };
}

/** All schools as picker options (name + branch), for the owner's account form. */
export async function schoolOptions(ctx: SessionContext): Promise<{ id: string; name: string; branch: string | null }[]> {
  assertNetworkRole(ctx);
  return db
    .select({ id: schools.id, name: schools.name, branch: schools.branch })
    .from(schools)
    .orderBy(asc(schools.name), asc(schools.branch));
}

/** One school, visible to managers/owner (any) and to its own admin. */
export async function getSchool(ctx: SessionContext, schoolId: string): Promise<SchoolRow> {
  const scope = schoolScope(ctx.actor);
  if (scope.kind === "school" && scope.schoolId !== schoolId) throw new AppError("NOT_FOUND", "School not found");
  const [row] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
  if (!row) throw new AppError("NOT_FOUND", "School not found");
  const counts = await countsBySchool([row.id]);
  return {
    id: row.id,
    name: row.name,
    branch: row.branch,
    ministryCode: row.ministryCode,
    setupCompleted: row.setupCompleted,
    createdAt: row.createdAt,
    ...counts.get(row.id)!,
  };
}

async function assertUniqueSchool(fields: SchoolFields, exceptId?: string): Promise<void> {
  // Same name + branch (compared loosely) is a duplicate.
  const candidates = await db
    .select({ id: schools.id, name: schools.name, branch: schools.branch })
    .from(schools)
    .where(exceptId ? ne(schools.id, exceptId) : undefined);
  const key = `${foldKey(fields.name)}|${foldKey(fields.branch ?? "")}`;
  if (candidates.some((s) => `${foldKey(s.name)}|${foldKey(s.branch ?? "")}` === key)) {
    throw new AppError("CONFLICT", "A school with this name and branch already exists", { field: "name" });
  }
}

export async function createSchool(ctx: SessionContext, fields: SchoolFields): Promise<{ id: string }> {
  assertNetworkRole(ctx);
  await consumeRate(ctx, "editSchool");
  await assertUniqueSchool(fields);
  const id = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schools).values({ id, ...fields });
      await recordAudit(ctx, "school_created", { schoolId: id, schoolName: fields.name, branch: fields.branch }, tx);
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError("CONFLICT", "This ministry code belongs to another school", { field: "ministryCode" });
    }
    throw error;
  }
  return { id };
}

export async function updateSchool(ctx: SessionContext, schoolId: string, fields: SchoolFields): Promise<void> {
  assertNetworkRole(ctx);
  await consumeRate(ctx, "editSchool");
  await getSchool(ctx, schoolId);
  await assertUniqueSchool(fields, schoolId);
  try {
    await db.transaction(async (tx) => {
      await tx.update(schools).set(fields).where(eq(schools.id, schoolId));
      await recordAudit(ctx, "school_updated", { schoolId, schoolName: fields.name }, tx);
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError("CONFLICT", "This ministry code belongs to another school", { field: "ministryCode" });
    }
    throw error;
  }
}

export interface SchoolImpact {
  students: number;
  teachers: number;
  admins: number;
  classes: number;
  homework: number;
  tests: number;
  worksheets: number;
}

/** What deleting the school would remove (shown in the confirmation dialog). */
export async function schoolDeletionImpact(ctx: SessionContext, schoolId: string): Promise<SchoolImpact> {
  assertNetworkRole(ctx);
  const school = await getSchool(ctx, schoolId);
  const countIn = async (table: typeof schema.homework | typeof schema.tests | typeof schema.worksheets) => {
    const [{ n }] = await db.select({ n: count() }).from(table).where(eq(table.schoolId, schoolId));
    return n;
  };
  return {
    students: school.students,
    teachers: school.teachers,
    admins: school.admins,
    classes: school.classes,
    homework: await countIn(schema.homework),
    tests: await countIn(schema.tests),
    worksheets: await countIn(schema.worksheets),
  };
}

/**
 * Deletes a school and every account bound to it (admins, teachers, students) in one
 * transaction. Managers/owners linked to it only lose the link. The caller typed the
 * school's exact name as confirmation.
 */
export async function deleteSchool(ctx: SessionContext, schoolId: string, confirmName: string): Promise<void> {
  assertNetworkRole(ctx);
  const school = await getSchool(ctx, schoolId);
  if (clean(confirmName) !== clean(school.name)) {
    throw new AppError("VALIDATION", "The typed name does not match", { field: "confirmName" });
  }
  await consumeRate(ctx, "deleteSchool");
  const [running] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.schoolId, schoolId), inArray(jobs.status, ["pending", "running"])))
    .limit(1);
  if (running) throw new AppError("CONFLICT", "An import is in progress for this school", { reason: "job_running" });

  const impact = await schoolDeletionImpact(ctx, schoolId);
  await db.transaction(async (tx) => {
    const members = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.schoolId, schoolId), inArray(users.role, ["admin", "teacher", "student"])));
    const ids = members.map((m) => m.id);
    await deletePrivateEvents(tx, ids);
    // Cascades classes, assignments, homework, tests, worksheets, jobs and announcements,
    // which also removes the content that blocks deleting its teachers.
    await tx.delete(schools).where(eq(schools.id, schoolId));
    for (let i = 0; i < ids.length; i += 500) {
      await tx.delete(users).where(inArray(users.id, ids.slice(i, i + 500)));
    }
    await recordAudit(ctx, "school_deleted", { schoolId: null, deletedSchoolId: schoolId, schoolName: school.name, branch: school.branch, ...impact }, tx);
  });
}

export const deleteSchoolSchema = z.object({ schoolId: z.uuid(), confirmName: z.string().max(300) });

// ---------------------------------------------------------------------------
// Import schools (and their classes) from a spreadsheet.

export const SCHOOL_COLUMN_ALIASES = {
  school: ["school", "school name", "اسم المدرسة", "المدرسة", "مدرسة"],
  branch: ["branch", "الفرع", "فرع"],
  ministryCode: ["ministry code", "ministry", "code", "الرقم الوزاري", "كود", "كود الوزارة"],
  grade: ["grade", "الصف", "صف"],
  section: ["section", "الشعبة", "شعبة", "الفصل", "فصل"],
} as const;

export type SchoolImportIssue =
  | { row: number; code: "BLANK_SCHOOL" | "FIELD_TOO_LONG" }
  | { row: number; code: "MINISTRY_CODE_IN_USE" | "CODE_CONFLICT_IN_GROUP"; value: string };

export interface SchoolImportResult {
  schools: { name: string; branch: string | null; status: "created" | "existing"; classesAdded: number; classesExisting: number }[];
  issues: SchoolImportIssue[];
}

interface SchoolGroup {
  name: string;
  branch: string | null;
  ministryCode: string | null;
  classes: { grade: string; section: string }[];
  rows: number[];
}

/** Groups spreadsheet rows (one row = one class) by school name + branch. Pure. */
export function groupSchoolRows(
  rows: readonly Record<string, string>[],
  rowNumbers: readonly number[],
): { groups: SchoolGroup[]; issues: SchoolImportIssue[] } {
  const groups = new Map<string, SchoolGroup>();
  const issues: SchoolImportIssue[] = [];
  rows.forEach((row, index) => {
    const rowNumber = rowNumbers[index] ?? index + 2;
    const name = clean(row.school ?? "");
    const branch = cleanOrNull(row.branch);
    const code = cleanOrNull(row.ministryCode);
    const grade = clean(row.grade ?? "");
    const section = clean(row.section ?? "");
    if (!name) {
      issues.push({ row: rowNumber, code: "BLANK_SCHOOL" });
      return;
    }
    if (name.length > 200 || (branch?.length ?? 0) > 100 || (code?.length ?? 0) > 50 || grade.length > 50 || section.length > 50) {
      issues.push({ row: rowNumber, code: "FIELD_TOO_LONG" });
      return;
    }
    const key = `${foldKey(name)}|${foldKey(branch ?? "")}`;
    let group = groups.get(key);
    if (!group) {
      group = { name, branch, ministryCode: code, classes: [], rows: [] };
      groups.set(key, group);
    } else if (code && group.ministryCode && foldKey(code) !== foldKey(group.ministryCode)) {
      issues.push({ row: rowNumber, code: "CODE_CONFLICT_IN_GROUP", value: code });
    } else if (code && !group.ministryCode) {
      group.ministryCode = code;
    }
    group.rows.push(rowNumber);
    if (grade && !group.classes.some((c) => foldKey(c.grade) === foldKey(grade) && foldKey(c.section) === foldKey(section))) {
      group.classes.push({ grade, section });
    }
  });
  return { groups: [...groups.values()], issues };
}

export async function importSchools(
  ctx: SessionContext,
  rows: readonly Record<string, string>[],
  rowNumbers: readonly number[],
): Promise<SchoolImportResult> {
  assertNetworkRole(ctx);
  await consumeRate(ctx, "importSchools");
  const { groups, issues } = groupSchoolRows(rows, rowNumbers);
  if (groups.length === 0) {
    throw new AppError("VALIDATION", "The file has no schools", { reason: "no_schools", issues });
  }

  const existing = await db.select().from(schools);
  const result: SchoolImportResult = { schools: [], issues };
  for (const group of groups) {
    const key = `${foldKey(group.name)}|${foldKey(group.branch ?? "")}`;
    const match = existing.find((s) => `${foldKey(s.name)}|${foldKey(s.branch ?? "")}` === key);
    let ministryCode = group.ministryCode;
    if (ministryCode) {
      const owner = existing.find((s) => s.ministryCode && foldKey(s.ministryCode) === foldKey(ministryCode!));
      if (owner && owner.id !== match?.id) {
        result.issues.push({ row: group.rows[0], code: "MINISTRY_CODE_IN_USE", value: ministryCode });
        ministryCode = null;
      }
    }
    await db.transaction(async (tx) => {
      let schoolId = match?.id;
      if (!schoolId) {
        schoolId = crypto.randomUUID();
        await tx.insert(schools).values({ id: schoolId, name: group.name, branch: group.branch, ministryCode });
        existing.push({ id: schoolId, name: group.name, branch: group.branch, ministryCode, setupCompleted: false, createdAt: new Date(), updatedAt: new Date() });
      } else if (ministryCode && !match?.ministryCode) {
        await tx.update(schools).set({ ministryCode }).where(eq(schools.id, schoolId));
      }
      const current = await tx.select().from(schoolClasses).where(eq(schoolClasses.schoolId, schoolId));
      let added = 0;
      for (const c of group.classes) {
        if (current.some((x) => foldKey(x.grade) === foldKey(c.grade) && foldKey(x.section) === foldKey(c.section))) continue;
        await tx.insert(schoolClasses).values({ schoolId, grade: c.grade, section: c.section });
        current.push({ id: "", schoolId, grade: c.grade, section: c.section, createdAt: new Date() });
        added++;
      }
      result.schools.push({
        name: group.name,
        branch: group.branch,
        status: match ? "existing" : "created",
        classesAdded: added,
        classesExisting: group.classes.length - added,
      });
    });
  }
  await recordAudit(ctx, "schools_imported", {
    created: result.schools.filter((s) => s.status === "created").length,
    existing: result.schools.filter((s) => s.status === "existing").length,
    classesAdded: result.schools.reduce((sum, s) => sum + s.classesAdded, 0),
  });
  return result;
}

