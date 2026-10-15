import "server-only";
import { eq } from "drizzle-orm";
import type { SessionContext } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/errors";
import { schoolScope } from "@/server/policy/scope";

/**
 * The school an administrative action applies to. Managers and the owner name any existing
 * school; a school admin always gets their own (a different id is treated as not found, so
 * another school's existence isn't revealed). Teachers and students are refused.
 */
export async function resolveSchool(ctx: SessionContext, schoolId?: string | null): Promise<string> {
  if (ctx.actor.role !== "owner" && ctx.actor.role !== "manager" && ctx.actor.role !== "admin") {
    throw new AppError("FORBIDDEN", "Only staff can manage schools");
  }
  const scope = schoolScope(ctx.actor);
  if (scope.kind === "school") {
    if (schoolId && schoolId !== scope.schoolId) throw new AppError("NOT_FOUND", "School not found");
    return scope.schoolId;
  }
  if (!schoolId) throw new AppError("VALIDATION", "A school is required", { field: "schoolId" });
  const [school] = await db
    .select({ id: schema.schools.id })
    .from(schema.schools)
    .where(eq(schema.schools.id, schoolId))
    .limit(1);
  if (!school) throw new AppError("NOT_FOUND", "School not found");
  return school.id;
}
