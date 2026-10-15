import type { ActionDetails, ActionResult } from "@/server/action";
import type { ErrorCode } from "@/server/errors";

// Client-side helpers around ActionResult (src/server/action.ts). Pure, unit-tested.

/** A failed call: either the server's AppError code or NETWORK when the request never completed. */
export type ActionFailure = {
  ok: false;
  code: ErrorCode | "NETWORK";
  message: string;
  fieldErrors?: Record<string, string[]>;
  details?: ActionDetails;
};

export type ActionOutcome<T> = { ok: true; data: T } | ActionFailure;

/** Calls a server action and turns a thrown network/transport error into a NETWORK failure. */
export async function callAction<I, O>(
  serverAction: (input: I) => Promise<ActionResult<O>>,
  input: I,
): Promise<ActionOutcome<O>> {
  try {
    return await serverAction(input);
  } catch {
    return { ok: false, code: "NETWORK", message: "Network error" };
  }
}

/**
 * The message key under common.errors for a failure code. Codes the client does not know
 * (a newer server, a typo) fall back to INTERNAL instead of showing a raw key.
 */
export function errorMessageKey<K extends string>(
  code: string,
  isKnown: (code: string) => code is K,
): K | "INTERNAL" {
  return isKnown(code) ? code : "INTERNAL";
}

/** First validation message per field, for forms that show one error under each input. */
export function firstFieldErrors(fieldErrors: Record<string, string[]> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors ?? {})
      .filter(([, messages]) => messages.length > 0)
      .map(([field, messages]) => [field, messages[0]]),
  );
}
