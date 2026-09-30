import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { AppError } from "@/server/errors";
import { canAccessArea, isRole, requiresTwoFactor, type Area, type Role } from "@/server/policy/roles";
import type { Actor } from "@/server/policy/scope";
import { auth } from "./auth";

export interface SessionContext {
  sessionId: string;
  actor: Actor;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: Role;
    twoFactorEnabled: boolean;
    mustChangePassword: boolean;
  };
}

// The session and user are re-read from the database on every request (no cookie
// cache), so a deactivated account or a changed role takes effect immediately.
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;
  const { session, user } = result;
  if (!user.isActive || !isRole(user.role)) return null;
  return {
    sessionId: session.id,
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
      image: user.image ?? null,
      role: user.role,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      mustChangePassword: user.mustChangePassword,
    },
  };
});

export interface RequireSessionOptions {
  /** Restrict to the roles allowed in this app area. */
  area?: Area;
  /**
   * Account-setup steps that must be finished before anything else works. Only the
   * setup endpoints themselves (change password, enroll 2FA) turn these off.
   */
  allowPendingPasswordChange?: boolean;
  allowPendingTwoFactor?: boolean;
}

// Every route handler and server action calls this. The proxy only does optimistic
// redirects and is not a security boundary.
export async function requireSession(options: RequireSessionOptions = {}): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) throw new AppError("UNAUTHENTICATED", "Sign in required");

  if (context.user.mustChangePassword && !options.allowPendingPasswordChange) {
    throw new AppError("PASSWORD_CHANGE_REQUIRED", "Change your temporary password first");
  }
  if (
    requiresTwoFactor(context.user.role) &&
    !context.user.twoFactorEnabled &&
    !options.allowPendingTwoFactor
  ) {
    throw new AppError("TWO_FACTOR_REQUIRED", "Two-factor authentication must be set up first");
  }
  if (options.area && !canAccessArea(context.user.role, options.area)) {
    throw new AppError("FORBIDDEN", `This area is not available to the ${context.user.role} role`);
  }
  return context;
}
