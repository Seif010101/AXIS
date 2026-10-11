import { beforeAll, describe, expect, it } from "vitest";
import { resetDatabase, TestClient } from "./helpers";

const PASSWORD = "Bootstrap-Pass-2026!";

function envWith(overrides: Record<string, string | undefined>): Record<string, string | undefined> {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    ALLOWED_EMAIL_DOMAIN: process.env.ALLOWED_EMAIL_DOMAIN,
    BOOTSTRAP_OWNER_EMAIL: "Founder@School.test",
    BOOTSTRAP_OWNER_NAME: "Founder",
    BOOTSTRAP_OWNER_PASSWORD: PASSWORD,
    ...overrides,
  };
}

describe("first-owner bootstrap", () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it("does nothing when not configured", async () => {
    const { bootstrapOwner } = await import("@/server/bootstrap-owner");
    expect(
      await bootstrapOwner(
        envWith({
          BOOTSTRAP_OWNER_EMAIL: undefined,
          BOOTSTRAP_OWNER_NAME: undefined,
          BOOTSTRAP_OWNER_PASSWORD: undefined,
        }),
      ),
    ).toBe("not-configured");
  });

  it("rejects partial configuration, foreign domains and short passwords", async () => {
    const { bootstrapOwner } = await import("@/server/bootstrap-owner");
    await expect(bootstrapOwner(envWith({ BOOTSTRAP_OWNER_NAME: undefined }))).rejects.toThrow(
      /must all be set/,
    );
    await expect(bootstrapOwner(envWith({ BOOTSTRAP_OWNER_EMAIL: "x@evil.test" }))).rejects.toThrow(
      /ending with/,
    );
    await expect(bootstrapOwner(envWith({ BOOTSTRAP_OWNER_PASSWORD: "short" }))).rejects.toThrow(
      /characters/,
    );
  });

  it("creates exactly one owner who can sign in and must change the password", async () => {
    const { bootstrapOwner } = await import("@/server/bootstrap-owner");
    expect(await bootstrapOwner(envWith({}))).toBe("created");
    expect(await bootstrapOwner(envWith({ BOOTSTRAP_OWNER_EMAIL: "second@school.test" }))).toBe(
      "owner-exists",
    );

    const client = new TestClient("203.0.113.77");
    const signIn = await client.signIn("founder@school.test", PASSWORD);
    expect(signIn.status).toBe(200);
    const session = await client.request("GET", "/get-session");
    expect(session.body.user).toMatchObject({
      role: "owner",
      mustChangePassword: true,
      twoFactorEnabled: false,
    });

    const { db, schema } = await import("@/server/db");
    expect(await db.$count(schema.users)).toBe(1);
  });
});
