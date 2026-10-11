import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireSession, type RequireSessionOptions, type SessionContext } from "@/server/auth/session";
import { requireStepUp } from "@/server/auth/step-up";
import { AppError, type ErrorCode } from "@/server/errors";

// The one way to write a server action. It:
//   1. checks the session (and the app area), like every route handler must;
//   2. requires a fresh authenticator code when `stepUp` is set (high-risk actions);
//   3. validates the input with zod;
//   4. turns AppError into a serializable result instead of an opaque 500.
// Client components call actions through useAction() (src/hooks/use-action.ts), which
// shows localized errors and opens the step-up dialog on STEP_UP_REQUIRED.

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> };

export interface ActionOptions<Schema extends z.ZodType> extends RequireSessionOptions {
  input: Schema;
  /** High-risk action: requires an authenticator code verified in the last 5 minutes. */
  stepUp?: boolean;
}

export function action<Schema extends z.ZodType, Output>(
  options: ActionOptions<Schema>,
  handler: (input: z.output<Schema>, context: SessionContext) => Promise<Output>,
): (input: z.input<Schema>) => Promise<ActionResult<Output>> {
  const { input: schema, stepUp, ...sessionOptions } = options;
  return async (raw) => {
    try {
      const context = await requireSession(sessionOptions);
      if (stepUp) await requireStepUp(context);
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          code: "VALIDATION",
          message: "Invalid input",
          fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        };
      }
      return { ok: true, data: await handler(parsed.data, context) };
    } catch (error) {
      unstable_rethrow(error); // redirect(), notFound(), forbidden() must reach Next.js
      if (error instanceof AppError) return { ok: false, code: error.code, message: error.message };
      console.error("[action]", error);
      return { ok: false, code: "INTERNAL", message: "Internal server error" };
    }
  };
}
