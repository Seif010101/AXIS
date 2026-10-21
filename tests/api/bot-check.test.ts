import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ORIGIN, resetDatabase } from "./helpers";

// Turnstile is on for this file only: env is read once per test file, before any import
// below. Cloudflare itself is replaced by a stub that accepts exactly one token.
process.env.TURNSTILE_SITE_KEY = "test-site-key";
process.env.TURNSTILE_SECRET_KEY = "test-secret-key";

const GOOD_TOKEN = "human-token";
const siteverify = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
  const body = new URLSearchParams(String(init?.body));
  const ok = body.get("secret") === "test-secret-key" && body.get("response") === GOOD_TOKEN;
  return Response.json(
    ok ? { success: true, action: "login" } : { success: false, "error-codes": ["invalid-input-response"] },
  );
});
const realFetch = globalThis.fetch;

beforeAll(async () => {
  globalThis.fetch = siteverify as typeof fetch;
  await resetDatabase();
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

async function signIn(email: string, password: string, token?: string) {
  const { auth } = await import("@/server/auth/auth");
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.50",
        ...(token ? { "x-turnstile-token": token } : {}),
      },
      body: JSON.stringify({ email, password }),
    }),
  );
  return { status: response.status, body: await response.json().catch(() => null) };
}

describe("bot check on sign-in (Cloudflare Turnstile)", () => {
  let password: string;

  beforeAll(async () => {
    const { createAccount } = await import("@/server/services/accounts");
    ({ password } = await createAccount({ email: "human@school.test", name: "Human", role: "student" }));
  });

  it("refuses a sign-in without a token, before the password is checked", async () => {
    const response = await signIn("human@school.test", password);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("BOT_CHECK_FAILED");
  });

  it("refuses a forged token", async () => {
    const response = await signIn("human@school.test", password, "forged");
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("BOT_CHECK_FAILED");
  });

  it("regression: a bot hammering wrong passwords can't lock the real user out", async () => {
    const { LOGIN_ACCOUNT_RULE } = await import("@/server/auth/throttle");
    for (let i = 0; i <= LOGIN_ACCOUNT_RULE.max + 2; i++) {
      expect((await signIn("human@school.test", `guess-${i}`)).body.code).toBe("BOT_CHECK_FAILED");
    }
    const real = await signIn("human@school.test", password, GOOD_TOKEN);
    expect(real.status).toBe(200);
  });

  it("asks Cloudflare with the secret key, the token and the visitor's IP", async () => {
    siteverify.mockClear();
    await signIn("human@school.test", password, GOOD_TOKEN);
    expect(siteverify).toHaveBeenCalledOnce();
    const call = siteverify.mock.calls[0]!;
    expect(String(call[0])).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = new URLSearchParams(String(call[1]?.body));
    expect(body.get("remoteip")).toBe("203.0.113.50");
  });

  it("server-internal sign-ins (no HTTP request) are not affected", async () => {
    const { auth } = await import("@/server/auth/auth");
    const result = await auth.api.signInEmail({ body: { email: "human@school.test", password } });
    expect(result.user.email).toBe("human@school.test");
  });
});
