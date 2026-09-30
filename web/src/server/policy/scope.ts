import { AppError } from "@/server/errors";
import type { Role } from "./roles";

export interface Actor {
  id: string;
  role: Role;
  schoolId: string | null;
  grade?: string | null;
  section?: string | null;
}

export type SchoolScope = { kind: "all" } | { kind: "school"; schoolId: string };

// Owner and manager operate across the whole network; everyone else is bound to one school.
// A school-bound user without a school_id gets NO access. The legacy backend silently
// dropped the filter in that case and exposed every school's data.
export function schoolScope(actor: Actor): SchoolScope {
  if (actor.role === "owner" || actor.role === "manager") return { kind: "all" };
  if (!actor.schoolId) throw new AppError("NO_SCHOOL", "Account is not linked to a school");
  return { kind: "school", schoolId: actor.schoolId };
}

export function requireOwnSchool(actor: Actor): string {
  const scope = schoolScope(actor);
  if (scope.kind === "all") throw new AppError("FORBIDDEN", "This action needs a school-bound account");
  return scope.schoolId;
}

export function assertCanActOnSchool(actor: Actor, schoolId: string): void {
  const scope = schoolScope(actor);
  if (scope.kind === "school" && scope.schoolId !== schoolId) {
    throw new AppError("FORBIDDEN", "Resource belongs to another school");
  }
}

// Who may reset passwords, (de)activate or delete whom.
const MANAGEABLE: Record<Role, readonly Role[]> = {
  owner: ["manager", "admin", "teacher", "student"],
  manager: ["admin", "teacher", "student"],
  admin: ["teacher", "student"],
  teacher: [],
  student: [],
};

export interface ManagedUser {
  id: string;
  role: Role;
  schoolId: string | null;
}

export function assertCanManageUser(actor: Actor, target: ManagedUser): void {
  if (actor.id === target.id) throw new AppError("FORBIDDEN", "Use your own account settings instead");
  if (!MANAGEABLE[actor.role].includes(target.role)) {
    throw new AppError("FORBIDDEN", `A ${actor.role} cannot manage a ${target.role}`);
  }
  if (actor.role === "admin") {
    const schoolId = requireOwnSchool(actor);
    if (target.schoolId !== schoolId) throw new AppError("FORBIDDEN", "User belongs to another school");
  }
}

// Class targeting for homework/tests/worksheets: same grade, and either no section
// (whole grade) or the student's own section.
export interface ClassTarget {
  schoolId: string | null;
  grade: string | null;
  section: string | null;
}

export function studentCanSee(student: Actor, item: ClassTarget): boolean {
  if (!student.schoolId || item.schoolId !== student.schoolId) return false;
  if (!student.grade || item.grade !== student.grade) return false;
  return !item.section || item.section === student.section;
}
