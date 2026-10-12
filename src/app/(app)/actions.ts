"use server";

import { z } from "zod";
import { action } from "@/server/action";
import { verifyStepUp } from "@/server/auth/step-up";

// Called by the global step-up dialog (components/auth/step-up-dialog.tsx). A verified
// code opens a 5-minute window for high-risk actions on this session.
export const verifyStepUpAction = action(
  { input: z.object({ code: z.string().regex(/^\d{6}$/) }) },
  async ({ code }, ctx) => {
    const { expiresAt } = await verifyStepUp(ctx, code);
    return { expiresAt: expiresAt.toISOString() };
  },
);
