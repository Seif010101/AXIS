import "server-only";
import { TURNSTILE_LOGIN_ACTION } from "@/lib/turnstile";

// Cloudflare Turnstile: the bot check on the sign-in form. The browser solves an
// (usually invisible) challenge and gets a one-time token; the server confirms it with
// Cloudflare before the password is even looked at, so bots can neither guess passwords
// nor lock real users out by burning their failed-attempt budget.
//
// Pure apart from the network call (fetch is injectable), so it is unit-tested in
// tests/unit/turnstile.test.ts. Enforcement lives in guards.ts.

export { TURNSTILE_HEADER, TURNSTILE_LOGIN_ACTION } from "@/lib/turnstile";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// Cloudflare documents tokens of at most 2048 characters.
const MAX_TOKEN_LENGTH = 2048;
const TIMEOUT_MS = 5_000;

export type TurnstileFailure =
  /** No token sent: a script calling the API directly, or the widget never finished. */
  | "missing"
  /** Cloudflare says the token is invalid, expired, reused, or for another action. */
  | "rejected"
  /** Cloudflare could not be reached. Fails closed, but the user is told to retry. */
  | "unavailable";

export type TurnstileResult = { ok: true } | { ok: false; reason: TurnstileFailure; errorCodes?: string[] };

interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export interface VerifyTurnstileInput {
  secret: string;
  token: string | null | undefined;
  ip?: string | null;
  expectedAction?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function verifyTurnstileToken({
  secret,
  token,
  ip,
  expectedAction = TURNSTILE_LOGIN_ACTION,
  fetchImpl = fetch,
  timeoutMs = TIMEOUT_MS,
}: VerifyTurnstileInput): Promise<TurnstileResult> {
  const value = token?.trim();
  if (!value) return { ok: false, reason: "missing" };
  if (value.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "rejected" };

  const form = new URLSearchParams({ secret, response: value });
  if (ip) form.set("remoteip", ip);

  let data: SiteverifyResponse;
  try {
    const response = await fetchImpl(VERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };
    data = (await response.json()) as SiteverifyResponse;
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const errorCodes = data["error-codes"] ?? [];
  if (data.success !== true) {
    // A wrong secret or a Cloudflare-side fault is our problem, not the visitor's.
    const ours = errorCodes.some(
      (code) =>
        code === "missing-input-secret" || code === "invalid-input-secret" || code === "internal-error",
    );
    return { ok: false, reason: ours ? "unavailable" : "rejected", errorCodes };
  }
  // A token minted for another widget on the same site key can't be replayed here.
  // Cloudflare's test keys return no action, so an empty one is accepted.
  if (data.action && data.action !== expectedAction) {
    return { ok: false, reason: "rejected", errorCodes: ["action-mismatch"] };
  }
  return { ok: true };
}
