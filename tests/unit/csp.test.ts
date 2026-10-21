import { describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/csp";

const directives = (csp: string) =>
  Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

describe("content security policy", () => {
  it("only runs scripts carrying this request's nonce (no inline, no eval in production)", () => {
    const d = directives(buildCsp("abc123", false));
    expect(d["script-src"]).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(d["script-src"]).not.toContain("'unsafe-inline'");
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
  });

  it("allows the Cloudflare Turnstile widget frame", () => {
    const d = directives(buildCsp("n", false));
    expect(d["frame-src"]).toContain("https://challenges.cloudflare.com");
  });

  it("adds unsafe-eval only in development (React's error overlay needs it)", () => {
    expect(directives(buildCsp("n", true))["script-src"]).toContain("'unsafe-eval'");
    expect(directives(buildCsp("n", false))["script-src"]).not.toContain("'unsafe-eval'");
  });
});
