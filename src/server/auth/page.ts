import "server-only";
import { forbidden, redirect } from "next/navigation";
import { canAccessArea, homePath, requiresTwoFactor, type Area } from "@/server/policy/roles";
import { getSessionContext, type SessionContext } from "./session";

// Page-level gate for Server Components (layouts and pages). Instead of throwing AppError
// like requireSession(), it sends the browser where the user needs to go next. Server
// actions and route handlers keep using requireSession() / action().
export async function requirePageSession(area?: Area): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  if (context.user.mustChangePassword) redirect("/change-password");
  if (requiresTwoFactor(context.user.role) && !context.user.twoFactorEnabled) redirect("/setup-2fa");
  if (area && !canAccessArea(context.user.role, area)) redirect(homePath(context.user.role));
  return context;
}

// For pages that only make sense for a school-bound account (e.g. the owner opening a
// school admin page): renders src/app/forbidden.tsx instead of failing.
export function requirePageSchool(context: SessionContext): string {
  if (!context.actor.schoolId) forbidden();
  return context.actor.schoolId;
}
