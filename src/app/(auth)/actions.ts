"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { setLocaleCookie } from "@/server/auth/locale-cookie";
import { getSavedLanguage } from "@/server/modules/settings/settings";
import { homePath, requiresTwoFactor } from "@/server/policy/roles";

/**
 * Runs right after a successful sign-in (password, or password + code): restores the
 * user's saved UI language and says where to go next, so the browser lands on the right
 * screen without bouncing through redirects.
 */
export const completeSignInAction = action(
  { input: z.object({}), allowPendingPasswordChange: true, allowPendingTwoFactor: true },
  async (_input, ctx) => {
    const language = await getSavedLanguage(ctx.user.id);
    if (language) await setLocaleCookie(language);
    if (ctx.user.mustChangePassword) return { next: "/change-password" };
    if (requiresTwoFactor(ctx.user.role) && !ctx.user.twoFactorEnabled) return { next: "/setup-2fa" };
    return { next: homePath(ctx.user.role) };
  },
);
