"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { action } from "@/server/action";
import {
  addAssignment,
  assignmentSchema,
  createPerson,
  createPersonSchema,
  deletePerson,
  exportPeople,
  peopleFiltersSchema,
  personDeletionImpact,
  reissueCredentials,
  reissueSchema,
  removeAssignment,
  removeAssignmentSchema,
  resetPersonPassword,
  resetPersonTwoFactor,
  setActiveSchema,
  setPersonActive,
  updatePerson,
  updatePersonSchema,
} from "@/server/modules/schools/people";

// Account administration shared by /manager/schools/[id]/accounts, /admin/people and
// /owner/users. Every rule (scope, who-may-manage-whom) is enforced in the module.
// Actions that mint a password or remove access require a fresh authenticator code.

const userIdSchema = z.object({ userId: z.uuid() });

export const createPersonAction = action({ stepUp: true, input: createPersonSchema }, async (input, ctx) => {
  const credentials = await createPerson(ctx, input);
  refresh();
  return credentials;
});

export const updatePersonAction = action({ input: updatePersonSchema }, async (input, ctx) => {
  await updatePerson(ctx, input);
  refresh();
});

export const resetPasswordAction = action({ stepUp: true, input: userIdSchema }, async ({ userId }, ctx) => {
  const credentials = await resetPersonPassword(ctx, userId);
  refresh();
  return credentials;
});

export const resetTwoFactorAction = action({ stepUp: true, input: userIdSchema }, async ({ userId }, ctx) => {
  await resetPersonTwoFactor(ctx, userId);
  refresh();
});

export const reissueCredentialsAction = action(
  { stepUp: true, input: reissueSchema },
  async ({ userIds }, ctx) => {
    const credentials = await reissueCredentials(ctx, userIds);
    refresh();
    return credentials;
  },
);

export const setActiveAction = action(
  { stepUp: true, input: setActiveSchema },
  async ({ userId, isActive }, ctx) => {
    await setPersonActive(ctx, userId, isActive);
    refresh();
  },
);

export const personImpactAction = action({ input: userIdSchema }, ({ userId }, ctx) =>
  personDeletionImpact(ctx, userId),
);

export const deletePersonAction = action({ stepUp: true, input: userIdSchema }, async ({ userId }, ctx) => {
  await deletePerson(ctx, userId);
  refresh();
});

export const addAssignmentAction = action({ input: assignmentSchema }, async (input, ctx) => {
  await addAssignment(ctx, input);
  refresh();
});

export const removeAssignmentAction = action({ input: removeAssignmentSchema }, async (input, ctx) => {
  await removeAssignment(ctx, input.teacherId, input.assignmentId);
  refresh();
});

/** The filtered list as plain rows; the browser turns it into a CSV (no secrets inside). */
export const exportPeopleAction = action(
  {
    input: z.object({
      scope: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("school"), schoolId: z.uuid().optional() }),
        z.object({ kind: z.literal("directory") }),
      ]),
      filters: z.record(z.string(), z.string()).default({}),
    }),
  },
  async ({ scope, filters }, ctx) => {
    const rows = await exportPeople(ctx, scope, peopleFiltersSchema.parse(filters));
    return rows.map((r) => ({
      name: r.name,
      email: r.email,
      role: r.role,
      school: r.schoolName ? [r.schoolName, r.schoolBranch].filter(Boolean).join(" — ") : "",
      grade: r.grade ?? "",
      section: r.section ?? "",
      subject: r.subject ?? "",
      classes: r.assignments
        .map((a) => [a.grade, a.section, a.subject].filter(Boolean).join(" / "))
        .join("; "),
      ministryId: r.ministryId ?? "",
      status: r.isActive ? (r.pending ? "pending" : "active") : "inactive",
      lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : "",
    }));
  },
);
