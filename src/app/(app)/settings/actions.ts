"use server";

import { refresh } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { action } from "@/server/action";
import { setLocaleCookie } from "@/server/auth/locale-cookie";
import {
  avatarSchema,
  languageSchema,
  learningSchema,
  notificationsSchema,
  revokeSessionSchema,
  revokeOtherSessions,
  revokeSession,
  setAvatar,
  setLanguage,
  setLearningPreferences,
  setNotificationsEnabled,
} from "@/server/modules/settings/settings";

// Also used by the language switcher in the top bar and on the setup screens, so it works
// before the password change / 2FA enrollment is finished.
export const updateLanguageAction = action(
  { input: languageSchema, allowPendingPasswordChange: true, allowPendingTwoFactor: true },
  async ({ language }, ctx) => {
    await setLanguage(ctx, language);
    await setLocaleCookie(language);
    refresh();
  },
);

export const updateAvatarAction = action({ input: avatarSchema }, async ({ preset }, ctx) => {
  const image = await setAvatar(ctx, preset);
  refresh();
  return { image };
});

export const updateNotificationsAction = action({ input: notificationsSchema }, async ({ enabled }, ctx) => {
  await setNotificationsEnabled(ctx, enabled, await getLocale());
});

export const updateLearningAction = action({ area: "student", input: learningSchema }, async (input, ctx) => {
  await setLearningPreferences(ctx, input, await getLocale());
});

export const revokeSessionAction = action({ input: revokeSessionSchema }, async ({ sessionId }, ctx) => {
  await revokeSession(ctx, sessionId);
  refresh();
});

export const revokeOtherSessionsAction = action({ input: z.object({}) }, async (_input, ctx) => {
  const count = await revokeOtherSessions(ctx);
  refresh();
  return { count };
});
