import { describe, expect, it } from "vitest";
import { callAction, errorMessageKey, firstFieldErrors } from "@/lib/action-result";

describe("action results on the client", () => {
  it("passes results through and turns transport errors into NETWORK", async () => {
    await expect(callAction(async (n: number) => ({ ok: true as const, data: n * 2 }), 21)).resolves.toEqual({
      ok: true,
      data: 42,
    });
    await expect(
      callAction(async () => ({ ok: false as const, code: "FORBIDDEN" as const, message: "no" }), undefined),
    ).resolves.toEqual({ ok: false, code: "FORBIDDEN", message: "no" });
    await expect(
      callAction(async () => {
        throw new TypeError("Failed to fetch");
      }, undefined),
    ).resolves.toMatchObject({ ok: false, code: "NETWORK" });
  });

  it("falls back to INTERNAL for unknown error codes", () => {
    const known = new Set(["FORBIDDEN", "NETWORK"]);
    const isKnown = (code: string): code is "FORBIDDEN" | "NETWORK" => known.has(code);
    expect(errorMessageKey("FORBIDDEN", isKnown)).toBe("FORBIDDEN");
    expect(errorMessageKey("SOMETHING_NEW", isKnown)).toBe("INTERNAL");
  });

  it("keeps the first message of each field", () => {
    expect(firstFieldErrors({ title: ["Too short", "Required"], body: [] })).toEqual({ title: "Too short" });
    expect(firstFieldErrors(undefined)).toEqual({});
  });
});
