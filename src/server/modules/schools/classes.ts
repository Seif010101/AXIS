import "server-only";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import type { SessionContext } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/errors";
import { resolveSchool } from "./access";
import { clean, foldKey, naturalCompare, splitList } from "./naming";

const { schoolClasses, users, teacherAssignments } = schema;

export interface ClassRow {
  grade: string;
  /** '' = the whole grade. */
  section: string;
  students: number;
  assignments: number;
}

export interface GradeGroup {
  grade: string;
  classes: ClassRow[];
}

/** The school's classes grouped by grade, with student and teacher-assignment counts. */
export async function listClasses(ctx: SessionContext, schoolId?: string): Promise<GradeGroup[]> {
  const id = await resolveSchool(ctx, schoolId);
  const classes = await db
    .select({ grade: schoolClasses.grade, section: schoolClasses.section })
    .from(schoolClasses)
    .where(eq(schoolClasses.schoolId, id));
  const students = await db
    .select({ grade: users.grade, section: users.section, n: count() })
    .from(users)
    .where(and(eq(users.schoolId, id), eq(users.role, "student")))
    .groupBy(users.grade, users.section);
  const assignments = await db
    .select({ grade: teacherAssignments.grade, section: teacherAssignments.section, n: count() })
    .from(teacherAssignments)
    .where(eq(teacherAssignments.schoolId, id))
    .groupBy(teacherAssignments.grade, teacherAssignments.section);

  const groups = new Map<string, GradeGroup>();
  for (const c of classes) {
    const group = groups.get(c.grade) ?? { grade: c.grade, classes: [] };
    groups.set(c.grade, group);
    // A whole-grade row counts every student of the grade.
    const studentCount = students
      .filter((s) => s.grade === c.grade && (c.section === "" || (s.section ?? "") === c.section))
      .reduce((sum, s) => sum + s.n, 0);
    const assignmentCount = assignments
      .filter((a) => a.grade === c.grade && a.section === c.section)
      .reduce((sum, a) => sum + a.n, 0);
    group.classes.push({ grade: c.grade, section: c.section, students: studentCount, assignments: assignmentCount });
  }
  return [...groups.values()]
    .sort((a, b) => naturalCompare(a.grade, b.grade))
    .map((g) => ({ ...g, classes: g.classes.sort((a, b) => naturalCompare(a.section, b.section)) }));
}

export const addClassesSchema = z.object({
  schoolId: z.uuid().optional(),
  grade: z.string().transform(clean).pipe(z.string().min(1).max(50)),
  sections: z.string().max(2000).default(""),
});

/** Adds a grade with one or more sections (an empty list adds the whole-grade class). */
export async function addClasses(
  ctx: SessionContext,
  input: z.output<typeof addClassesSchema>,
): Promise<{ added: number; existing: number }> {
  const id = await resolveSchool(ctx, input.schoolId);
  const sections = splitList(input.sections);
  if (sections.some((s) => s.length > 50)) throw new AppError("VALIDATION", "Section too long", { field: "sections" });
  const wanted = sections.length ? sections : [""];

  const current = await db.select().from(schoolClasses).where(eq(schoolClasses.schoolId, id));
  // Reuse the stored spelling of an existing grade so students and content keep matching.
  const grade = current.find((c) => foldKey(c.grade) === foldKey(input.grade))?.grade ?? input.grade;
  let added = 0;
  for (const section of wanted) {
    const exists = current.some((c) => foldKey(c.grade) === foldKey(grade) && foldKey(c.section) === foldKey(section));
    if (exists) continue;
    await db.insert(schoolClasses).values({ schoolId: id, grade, section }).onDuplicateKeyUpdate({ set: { grade } });
    added++;
  }
  return { added, existing: wanted.length - added };
}

export const deleteClassSchema = z.object({
  schoolId: z.uuid().optional(),
  grade: z.string().min(1).max(50),
  section: z.string().max(50),
});

/** Removes a class that no student or teacher assignment uses. */
export async function deleteClass(ctx: SessionContext, input: z.output<typeof deleteClassSchema>): Promise<void> {
  const id = await resolveSchool(ctx, input.schoolId);
  const [{ students }] = await db
    .select({ students: count() })
    .from(users)
    .where(
      and(
        eq(users.schoolId, id),
        eq(users.role, "student"),
        eq(users.grade, input.grade),
        ...(input.section ? [eq(users.section, input.section)] : []),
      ),
    );
  const [{ assignments }] = await db
    .select({ assignments: count() })
    .from(teacherAssignments)
    .where(
      and(
        eq(teacherAssignments.schoolId, id),
        eq(teacherAssignments.grade, input.grade),
        eq(teacherAssignments.section, input.section),
      ),
    );
  if (students > 0 || assignments > 0) {
    throw new AppError("CONFLICT", "The class is still in use", { reason: "class_in_use", students, assignments });
  }
  const result = await db
    .delete(schoolClasses)
    .where(
      and(
        eq(schoolClasses.schoolId, id),
        eq(schoolClasses.grade, input.grade),
        eq(schoolClasses.section, input.section),
      ),
    );
  if (result[0].affectedRows === 0) throw new AppError("NOT_FOUND", "Class not found");
}

/** Finds the stored class for a grade/section typed by a user (loose match), or null. */
export async function matchClass(
  schoolId: string,
  grade: string,
  section: string,
): Promise<{ grade: string; section: string } | null> {
  const classes = await db
    .select({ grade: schoolClasses.grade, section: schoolClasses.section })
    .from(schoolClasses)
    .where(eq(schoolClasses.schoolId, schoolId));
  return (
    classes.find((c) => foldKey(c.grade) === foldKey(grade) && foldKey(c.section) === foldKey(section)) ?? null
  );
}

