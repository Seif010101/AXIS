import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { contextFor, createSchool, createUser } from "./fixtures";
import { resetDatabase } from "./helpers";

type Ctx = ReturnType<typeof contextFor>;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
}

const m = {
  schools: () => import("@/server/modules/schools/schools"),
  classes: () => import("@/server/modules/schools/classes"),
  people: () => import("@/server/modules/schools/people"),
};

let owner: Ctx, manager: Ctx, adminA: Ctx, adminB: Ctx, teacherA: Ctx;
let schoolA: string, schoolB: string;

beforeAll(async () => {
  await resetDatabase();
  schoolA = (await createSchool("Alpha School", "North")).id;
  schoolB = (await createSchool("Beta School")).id;
  owner = contextFor(await createUser({ role: "owner", twoFactorEnabled: true }));
  manager = contextFor(await createUser({ role: "manager", twoFactorEnabled: true }));
  adminA = contextFor(await createUser({ role: "admin", schoolId: schoolA, twoFactorEnabled: true }));
  adminB = contextFor(await createUser({ role: "admin", schoolId: schoolB, twoFactorEnabled: true }));
  teacherA = contextFor(await createUser({ role: "teacher", schoolId: schoolA }));
  const { addClasses } = await m.classes();
  await addClasses(manager, { schoolId: schoolA, grade: "5", sections: "A, B" });
  await addClasses(manager, { schoolId: schoolB, grade: "7", sections: "" });
});

describe("schools", () => {
  it("only managers and the owner create schools; duplicates are refused", async () => {
    const { createSchool: create, schoolFieldsSchema } = await m.schools();
    const fields = schoolFieldsSchema.parse({ name: "  Gamma   School ", branch: "East" });
    expect(fields).toEqual({ name: "Gamma School", branch: "East", ministryCode: null });
    const { id } = await create(manager, fields);
    expect(id).toBeTruthy();
    expect(await codeOf(create(owner, schoolFieldsSchema.parse({ name: "gamma school", branch: "east" })))).toBe("CONFLICT");
    expect(await codeOf(create(adminA, schoolFieldsSchema.parse({ name: "Delta" })))).toBe("FORBIDDEN");
    expect(await codeOf(create(teacherA, schoolFieldsSchema.parse({ name: "Delta" })))).toBe("FORBIDDEN");
  });

  it("admins see only their own school", async () => {
    const { getSchool, listSchools, schoolListSchema } = await m.schools();
    expect((await getSchool(adminA, schoolA)).name).toBe("Alpha School");
    expect(await codeOf(getSchool(adminA, schoolB))).toBe("NOT_FOUND");
    expect(await codeOf(listSchools(adminA, schoolListSchema.parse({})))).toBe("FORBIDDEN");
    const list = await listSchools(manager, schoolListSchema.parse({ q: "alpha" }));
    expect(list.rows.map((r) => r.name)).toEqual(["Alpha School"]);
    expect(list.rows[0]).toMatchObject({ classes: 2, admins: 1, teachers: 1 });
  });

  it("groups imported rows by school and reports issues", async () => {
    const { groupSchoolRows } = await m.schools();
    const { groups, issues } = groupSchoolRows(
      [
        { school: "Omega", branch: "", ministryCode: "M1", grade: "1", section: "A" },
        { school: "omega ", branch: "", ministryCode: "", grade: "1", section: "B" },
        { school: "", branch: "", ministryCode: "", grade: "2", section: "" },
        { school: "Omega", branch: "", ministryCode: "M2", grade: "1", section: "a" },
      ],
      [2, 3, 4, 5],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].classes).toEqual([
      { grade: "1", section: "A" },
      { grade: "1", section: "B" },
    ]);
    expect(issues).toEqual([
      { row: 4, code: "BLANK_SCHOOL" },
      { row: 5, code: "CODE_CONFLICT_IN_GROUP", value: "M2" },
    ]);
  });
});

describe("classes", () => {
  it("adds sections idempotently and refuses deleting a class in use", async () => {
    const { addClasses, deleteClass, listClasses } = await m.classes();
    expect(await addClasses(adminA, { grade: "5", sections: "b, C" })).toEqual({ added: 1, existing: 1 });
    await createUser({ role: "student", schoolId: schoolA, grade: "5", section: "C" });
    const groups = await listClasses(adminA);
    expect(groups[0].classes.map((c) => [c.section, c.students])).toEqual([
      ["A", 0],
      ["B", 0],
      ["C", 1],
    ]);
    expect(await codeOf(deleteClass(adminA, { grade: "5", section: "C" }))).toBe("CONFLICT");
    expect(await codeOf(deleteClass(adminA, { schoolId: schoolB, grade: "7", section: "" }))).toBe("NOT_FOUND");
  });
});

describe("accounts", () => {
  it("creates a student with a generated email and a one-time password", async () => {
    const { createPerson, createPersonSchema } = await m.people();
    const created = await createPerson(
      adminA,
      createPersonSchema.parse({ role: "student", name: "Sara Ali", grade: "5", section: "a", ministryId: "S-100" }),
    );
    expect(created).toMatchObject({ email: "axiss100@school.test", grade: "5", section: "A", role: "student" });
    expect(created.password).toHaveLength(12);

    const { db, schema } = await import("@/server/db");
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, created.userId));
    expect(row).toMatchObject({ schoolId: schoolA, mustChangePassword: true });

    // Same ministry ID, same school and role → conflict; unknown class → validation.
    expect(
      await codeOf(createPerson(adminA, createPersonSchema.parse({ role: "student", name: "Other", grade: "5", ministryId: "S-100" }))),
    ).toBe("CONFLICT");
    expect(await codeOf(createPerson(adminA, createPersonSchema.parse({ role: "student", name: "Other", grade: "9" })))).toBe(
      "VALIDATION",
    );
  });

  it("enforces who may create which role, and where", async () => {
    const { createPerson, createPersonSchema } = await m.people();
    const admin = createPersonSchema.parse({ role: "admin", name: "New Admin", schoolId: schoolB });
    expect(await codeOf(createPerson(adminA, admin))).toBe("FORBIDDEN");
    expect(await codeOf(createPerson(manager, createPersonSchema.parse({ role: "manager", name: "M Two" })))).toBe("FORBIDDEN");
    const viaManager = await createPerson(manager, admin);
    expect(viaManager.email).toMatch(/^axis\.admin\d+@school\.test$/);
    const ownerMade = await createPerson(owner, createPersonSchema.parse({ role: "manager", name: "Network Lead" }));
    expect(ownerMade.email).toMatch(/^axis\.manager\d+@school\.test$/);
    // An admin naming another school is treated as not found.
    expect(
      await codeOf(createPerson(adminA, createPersonSchema.parse({ role: "teacher", name: "Tee", schoolId: schoolB }))),
    ).toBe("NOT_FOUND");
  });

  it("lists people within the actor's scope only", async () => {
    const { listPeople, peopleFiltersSchema } = await m.people();
    const all = peopleFiltersSchema.parse({});
    const own = await listPeople(adminA, { kind: "school" }, all);
    expect(own.rows.every((r) => r.schoolId === schoolA && r.role !== "admin")).toBe(true);
    expect(await codeOf(listPeople(adminA, { kind: "school", schoolId: schoolB }, all))).toBe("NOT_FOUND");
    expect(await codeOf(listPeople(manager, { kind: "directory" }, all))).toBe("FORBIDDEN");
    const directory = await listPeople(owner, { kind: "directory" }, peopleFiltersSchema.parse({ school: "none" }));
    expect(directory.rows.every((r) => r.schoolId === null && (r.role as string) !== "owner")).toBe(true);
    const search = await listPeople(manager, { kind: "school", schoolId: schoolA }, peopleFiltersSchema.parse({ q: "sara%" }));
    expect(search.total).toBe(0); // % is matched literally
  });

  it("resets passwords and (de)activates only manageable accounts", async () => {
    const { resetPersonPassword, setPersonActive } = await m.people();
    const student = await createUser({ role: "student", schoolId: schoolB, grade: "7" });
    expect(await codeOf(resetPersonPassword(adminA, student.id))).toBe("NOT_FOUND");
    expect(await codeOf(resetPersonPassword(adminB, adminB.user.id))).toBe("FORBIDDEN");
    expect(await codeOf(setPersonActive(adminA, adminB.user.id, false))).toBe("NOT_FOUND");
    const otherAdmin = await createUser({ role: "admin", schoolId: schoolB });
    expect(await codeOf(setPersonActive(adminB, otherAdmin.id, false))).toBe("FORBIDDEN");

    const reset = await resetPersonPassword(adminB, student.id);
    expect(reset.password).toHaveLength(12);
    await setPersonActive(adminB, student.id, false);
    const { db, schema } = await import("@/server/db");
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, student.id));
    expect(row).toMatchObject({ isActive: false, mustChangePassword: true });
  });

  it("re-issues credentials only for accounts that never signed in", async () => {
    const { reissueCredentials } = await m.people();
    const fresh = await createUser({ role: "student", schoolId: schoolB, grade: "7" });
    const { db, schema } = await import("@/server/db");
    await db.update(schema.users).set({ mustChangePassword: true }).where(eq(schema.users.id, fresh.id));
    const used = await createUser({ role: "student", schoolId: schoolB, grade: "7" });
    await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, used.id));
    const result = await reissueCredentials(adminB, [fresh.id, used.id]);
    expect(result.map((r) => r.userId)).toEqual([fresh.id]);
    expect(await codeOf(reissueCredentials(adminB, [used.id]))).toBe("VALIDATION");
  });

  it("deletes accounts (managers only), protects authored content and removes private events", async () => {
    const { deletePerson } = await m.people();
    const { db, schema } = await import("@/server/db");
    const student = await createUser({ role: "student", schoolId: schoolA, grade: "5" });
    await db.insert(schema.analyticsEvents).values([
      { userId: student.id, eventType: "mood_tracker", eventData: { note: "private" } },
      { userId: student.id, eventType: "login" },
    ]);
    expect(await codeOf(deletePerson(adminA, student.id))).toBe("FORBIDDEN");
    await deletePerson(manager, student.id);
    const events = await db.select().from(schema.analyticsEvents).where(eq(schema.analyticsEvents.eventType, "mood_tracker"));
    expect(events).toHaveLength(0);
    const logins = await db.select().from(schema.analyticsEvents).where(eq(schema.analyticsEvents.eventType, "login"));
    expect(logins.some((e) => e.userId === null)).toBe(true);

    await db.insert(schema.homework).values({ teacherId: teacherA.user.id, schoolId: schoolA, grade: "5", title: "HW" });
    expect(await codeOf(deletePerson(manager, teacherA.user.id))).toBe("CONFLICT");
  });

  it("manages teacher assignments inside the teacher's school", async () => {
    const { addAssignment, removeAssignment, assignmentSchema, listPeople, peopleFiltersSchema } = await m.people();
    await addAssignment(adminA, assignmentSchema.parse({ teacherId: teacherA.user.id, grade: "5", section: "b", subject: "Math" }));
    expect(
      await codeOf(addAssignment(adminA, assignmentSchema.parse({ teacherId: teacherA.user.id, grade: "5", section: "B", subject: "Math" }))),
    ).toBe("CONFLICT");
    expect(
      await codeOf(addAssignment(adminA, assignmentSchema.parse({ teacherId: teacherA.user.id, grade: "7", section: "" }))),
    ).toBe("VALIDATION");
    const list = await listPeople(adminA, { kind: "school" }, peopleFiltersSchema.parse({ role: "teacher" }));
    const row = list.rows.find((r) => r.id === teacherA.user.id)!;
    expect(row.assignments).toMatchObject([{ grade: "5", section: "B", subject: "Math" }]);
    expect(await codeOf(removeAssignment(adminB, teacherA.user.id, row.assignments[0].id))).toBe("NOT_FOUND");
    await removeAssignment(adminA, teacherA.user.id, row.assignments[0].id);
  });
});

describe("deleting a school", () => {
  it("requires the exact name and removes the school's accounts but not managers", async () => {
    const { deleteSchool } = await m.schools();
    const doomed = (await createSchool("Doomed")).id;
    const student = await createUser({ role: "student", schoolId: doomed, grade: "1" });
    const linkedManager = await createUser({ role: "manager", schoolId: doomed });
    expect(await codeOf(deleteSchool(manager, doomed, "Doomed!"))).toBe("VALIDATION");
    expect(await codeOf(deleteSchool(adminA, doomed, "Doomed"))).toBe("FORBIDDEN");
    await deleteSchool(manager, doomed, " Doomed ");

    const { db, schema } = await import("@/server/db");
    expect(await db.select().from(schema.users).where(eq(schema.users.id, student.id))).toHaveLength(0);
    const [kept] = await db.select().from(schema.users).where(eq(schema.users.id, linkedManager.id));
    expect(kept.schoolId).toBeNull();
  });
});
