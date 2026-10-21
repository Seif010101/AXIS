import { describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken } from "@/server/auth/turnstile";

const reply = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );

describe("Turnstile verification", () => {
  it("accepts a token Cloudflare confirms, sending secret, token and visitor IP", async () => {
    const fetchImpl = reply({ success: true, action: "login", hostname: "school.example" });
    const result = await verifyTurnstileToken({
      secret: "s3cret",
      token: "tok",
      ip: "198.51.100.7",
      fetchImpl,
    });
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = new URLSearchParams(String(init?.body));
    expect(Object.fromEntries(body)).toEqual({ secret: "s3cret", response: "tok", remoteip: "198.51.100.7" });
  });

  it("rejects a missing token without calling Cloudflare", async () => {
    const fetchImpl = reply({ success: true });
    expect(await verifyTurnstileToken({ secret: "s", token: null, fetchImpl })).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(await verifyTurnstileToken({ secret: "s", token: "  ", fetchImpl })).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects oversized tokens without calling Cloudflare", async () => {
    const fetchImpl = reply({ success: true });
    const result = await verifyTurnstileToken({ secret: "s", token: "x".repeat(2049), fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: "rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects invalid, expired or reused tokens", async () => {
    const fetchImpl = reply({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(await verifyTurnstileToken({ secret: "s", token: "old", fetchImpl })).toEqual({
      ok: false,
      reason: "rejected",
      errorCodes: ["timeout-or-duplicate"],
    });
  });

  it("regression: a token minted for another widget action can't be replayed on sign-in", async () => {
    const fetchImpl = reply({ success: true, action: "contact-form" });
    expect(await verifyTurnstileToken({ secret: "s", token: "tok", fetchImpl })).toMatchObject({
      ok: false,
      reason: "rejected",
    });
  });

  it("accepts Cloudflare's test keys, which return no action", async () => {
    const fetchImpl = reply({ success: true, action: "" });
    expect(await verifyTurnstileToken({ secret: "s", token: "XXXX.DUMMY.TOKEN.XXXX", fetchImpl })).toEqual({
      ok: true,
    });
  });

  it("reports a wrong secret or Cloudflare outage as unavailable, not as the visitor's fault", async () => {
    const badSecret = reply({ success: false, "error-codes": ["invalid-input-secret"] });
    expect(await verifyTurnstileToken({ secret: "s", token: "tok", fetchImpl: badSecret })).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
    const serverError = reply({}, 502);
    expect(await verifyTurnstileToken({ secret: "s", token: "tok", fetchImpl: serverError })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await verifyTurnstileToken({ secret: "s", token: "tok", fetchImpl: offline })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
