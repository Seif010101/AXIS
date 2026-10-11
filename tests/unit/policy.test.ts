import { describe, expect, it } from "vitest";
import { AppError } from "@/server/errors";
import { AREA_ACCESS, canAccessArea, requiresTwoFactor, ROLES, type Area } from "@/server/policy/roles";
import {
  assertCanActOnSchool,
  assertCanManageUser,
  schoolScope,
  studentCanSee,
  type Actor,
} from "@/server/policy/scope";

const actor = (role: Actor["role"], schoolId: string | null = "s1", extra: Partial<Actor> = {}): Actor => ({
  id: `${role}-1`,
  role,
  schoolId,
  ...extra,
});

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : "NOT_APP_ERROR";
  }
  return undefined;
}

describe("area access matrix", () => {
  const expected: Record<Area, string[]> = {
    owner: ["owner"],
    manager: ["manager", "owner"],
    admin: ["admin", "owner"],
    teacher: ["teacher", "owner"],
    student: ["student", "owner"],
  };

  it.each(Object.keys(AREA_ACCESS) as Area[])("%s area admits exactly the expected roles", (area) => {
    const admitted = ROLES.filter((r) => canAccessArea(r, area));
    expect(admitted.sort()).toEqual([...expected[area]].sort());
  });

  it("regression: school admin can no longer enter /manager", () => {
    expect(canAccessArea("admin", "manager")).toBe(false);
  });

  it("owner, manager and admin must enroll 2FA; teachers and students don't", () => {
    expect(ROLES.filter(requiresTwoFactor).sort()).toEqual(["admin", "manager", "owner"]);
  });
});

describe("school scope", () => {
  it("owner and manager are network-wide", () => {
    expect(schoolScope(actor("owner", null))).toEqual({ kind: "all" });
    expect(schoolScope(actor("manager", null))).toEqual({ kind: "all" });
  });

  it("school-bound roles are limited to their school", () => {
    for (const role of ["admin", "teacher", "student"] as const) {
      expect(schoolScope(actor(role, "s1"))).toEqual({ kind: "school", schoolId: "s1" });
    }
  });

  it("regression: missing school_id means no access, never 'all schools'", () => {
    for (const role of ["admin", "teacher", "student"] as const) {
      expect(codeOf(() => schoolScope(actor(role, null)))).toBe("NO_SCHOOL");
    }
  });

  it("regression: admin cannot act on another school", () => {
    expect(codeOf(() => assertCanActOnSchool(actor("admin", "s1"), "s2"))).toBe("FORBIDDEN");
    expect(codeOf(() => assertCanActOnSchool(actor("admin", "s1"), "s1"))).toBeUndefined();
    expect(codeOf(() => assertCanActOnSchool(actor("manager", null), "s2"))).toBeUndefined();
  });
});

describe("user management", () => {
  const target = (role: Actor["role"], schoolId: string | null = "s1") => ({
    id: `t-${role}`,
    role,
    schoolId,
  });

  it("regression: nobody can reset or disable an owner", () => {
    for (const role of ROLES) {
      expect(codeOf(() => assertCanManageUser(actor(role, null), target("owner", null)))).toBe("FORBIDDEN");
    }
  });

  it("regression: admin without a school cannot manage anyone", () => {
    expect(codeOf(() => assertCanManageUser(actor("admin", null), target("student")))).toBe("NO_SCHOOL");
  });

  it("admin manages teachers and students of their own school only", () => {
    expect(codeOf(() => assertCanManageUser(actor("admin", "s1"), target("student", "s1")))).toBeUndefined();
    expect(codeOf(() => assertCanManageUser(actor("admin", "s1"), target("teacher", "s1")))).toBeUndefined();
    expect(codeOf(() => assertCanManageUser(actor("admin", "s1"), target("student", "s2")))).toBe(
      "FORBIDDEN",
    );
    expect(codeOf(() => assertCanManageUser(actor("admin", "s1"), target("admin", "s1")))).toBe("FORBIDDEN");
    expect(codeOf(() => assertCanManageUser(actor("admin", "s1"), target("manager", null)))).toBe(
      "FORBIDDEN",
    );
  });

  it("teachers and students manage nobody", () => {
    expect(codeOf(() => assertCanManageUser(actor("teacher"), target("student")))).toBe("FORBIDDEN");
    expect(codeOf(() => assertCanManageUser(actor("student"), target("student")))).toBe("FORBIDDEN");
  });

  it("nobody manages themselves through admin tools", () => {
    const self = actor("owner", null);
    expect(codeOf(() => assertCanManageUser(self, { id: self.id, role: "manager", schoolId: null }))).toBe(
      "FORBIDDEN",
    );
  });
});

describe("student class targeting", () => {
  const student = actor("student", "s1", { grade: "5", section: "A" });

  it("sees whole-grade items and their own section", () => {
    expect(studentCanSee(student, { schoolId: "s1", grade: "5", section: null })).toBe(true);
    expect(studentCanSee(student, { schoolId: "s1", grade: "5", section: "A" })).toBe(true);
  });

  it("does not see other sections, grades or schools", () => {
    expect(studentCanSee(student, { schoolId: "s1", grade: "5", section: "B" })).toBe(false);
    expect(studentCanSee(student, { schoolId: "s1", grade: "6", section: null })).toBe(false);
    expect(studentCanSee(student, { schoolId: "s2", grade: "5", section: null })).toBe(false);
  });

  it("regression: a student without a school sees nothing", () => {
    expect(
      studentCanSee(actor("student", null, { grade: "5" }), { schoolId: null, grade: "5", section: null }),
    ).toBe(false);
  });
});
