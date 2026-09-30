import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/errors";
import { resetDatabase, TestClient, totpFromUri, wrongCode } from "./helpers";

// Code under test reads the request through next/headers; point it at a test client.
const request = { headers: new Headers() };
vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => {
    throw new Error("`cookies` was called outside a request scope.");
  },
}));
const as = (client: TestClient) => {
  request.headers = client.headers;
};

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof AppError ? error.code : `unexpected: ${String(error)}`;
  }
  return undefined;
}

const load = async () => ({
  accounts: await import("@/server/services/accounts"),
  session: await import("@/server/auth/session"),
  stepUp: await import("@/server/auth/step-up"),
  throttle: await import("@/server/auth/throttle"),
  authModule: await import("@/server/auth/auth"),
  dbModule: await import("@/server/db"),
});
let m: Awaited<ReturnType<typeof load>>;

beforeAll(async () => {
  await resetDatabase();
  m = await load();
});

describe("account creation", () => {
  it("rejects emails outside the allowed domain and duplicates", async () => {
    expect(await codeOf(m.accounts.createAccount({ email: "x@gmail.com", name: "X", role: "student" }))).toBe(
      "VALIDATION",
    );
    await m.accounts.createAccount({ email: "dup@school.test", name: "Dup", role: "student" });
    expect(
      await codeOf(m.accounts.createAccount({ email: "DUP@school.test", name: "Dup", role: "student" })),
    ).toBe("CONFLICT");
  });

  it("generates unambiguous 12-character passwords and stores only a hash", async () => {
    const { password, id } = await m.accounts.createAccount({
      email: "hash@school.test",
      name: "H",
      role: "student",
    });
    expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{12}$/);
    const [account] = await m.dbModule.db
      .select()
      .from(m.dbModule.schema.accounts)
      .where(eq(m.dbModule.schema.accounts.userId, id));
    expect(account.providerId).toBe("credential");
    expect(account.password).toBeTruthy();
    expect(account.password).not.toContain(password);
  });

  it("public sign-up is disabled", async () => {
    const client = new TestClient();
    const response = await client.request("POST", "/sign-up/email", {
      email: "intruder@school.test",
      password: "Password123!",
      name: "Intruder",
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    const ctx = await m.authModule.auth.$context;
    expect(await ctx.internalAdapter.findUserByEmail("intruder@school.test")).toBeNull();
  });
});

describe("student sign-in", () => {
  const client = new TestClient();
  let password: string;
  let userId: string;

  beforeAll(async () => {
    const created = await m.accounts.createAccount({
      email: "student1@school.test",
      name: "Student One",
      role: "student",
      schoolId: null,
      grade: "5",
      section: "A",
    });
    password = created.password;
    userId = created.id;
  });

  it("no session before signing in", async () => {
    as(client);
    expect(await m.session.getSessionContext()).toBeNull();
    expect(await codeOf(m.session.requireSession())).toBe("UNAUTHENTICATED");
  });

  it("wrong password is rejected; correct password signs in without 2FA", async () => {
    expect((await client.signIn("student1@school.test", "wrong-password")).status).toBe(401);
    const ok = await client.signIn("student1@school.test", password);
    expect(ok.status).toBe(200);
    expect(ok.body.twoFactorRedirect).toBeFalsy();
    as(client);
    const context = await m.session.getSessionContext();
    expect(context?.actor).toMatchObject({ id: userId, role: "student", grade: "5", section: "A" });
  });

  it("sign-in records last login and an analytics event", async () => {
    const { db, schema } = m.dbModule;
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(user.lastLoginAt).toBeInstanceOf(Date);
    const events = await db
      .select()
      .from(schema.analyticsEvents)
      .where(eq(schema.analyticsEvents.userId, userId));
    expect(events.map((e) => e.eventType)).toContain("login");
  });

  it("the temporary password must be changed before anything else works", async () => {
    as(client);
    expect(await codeOf(m.session.requireSession())).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(await codeOf(m.session.requireSession({ allowPendingPasswordChange: true }))).toBeUndefined();

    const changed = await client.request("POST", "/change-password", {
      currentPassword: password,
      newPassword: "A-new-strong-password-1",
      revokeOtherSessions: true,
    });
    expect(changed.status).toBe(200);
    password = "A-new-strong-password-1";
    as(client);
    expect(await codeOf(m.session.requireSession())).toBeUndefined();
  });

  it("students are confined to the student area and need no 2FA", async () => {
    as(client);
    expect(await codeOf(m.session.requireSession({ area: "student" }))).toBeUndefined();
    for (const area of ["teacher", "admin", "manager", "owner"] as const) {
      expect(await codeOf(m.session.requireSession({ area }))).toBe("FORBIDDEN");
    }
  });

  it("step-up is impossible without 2FA, so high-risk actions stay closed", async () => {
    as(client);
    const context = await m.session.requireSession();
    expect(await codeOf(m.stepUp.requireStepUp(context))).toBe("STEP_UP_REQUIRED");
    expect(await codeOf(m.stepUp.verifyStepUp(context, "123456"))).toBe("TWO_FACTOR_REQUIRED");
  });

  it("deactivating the account kills the live session and blocks sign-in", async () => {
    await m.accounts.setAccountActive(userId, false);
    as(client);
    expect(await m.session.getSessionContext()).toBeNull();
    const blocked = await new TestClient().signIn("student1@school.test", password);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("ACCOUNT_DISABLED");

    await m.accounts.setAccountActive(userId, true);
    expect((await new TestClient().signIn("student1@school.test", password)).status).toBe(200);
  });

  it("password reset signs the user out everywhere and forces a new change", async () => {
    const live = new TestClient();
    await live.signIn("student1@school.test", password);
    const temporary = await m.accounts.resetPassword(userId);
    as(live);
    expect(await m.session.getSessionContext()).toBeNull();
    expect((await new TestClient().signIn("student1@school.test", password)).status).toBe(401);
    const fresh = new TestClient();
    expect((await fresh.signIn("student1@school.test", temporary)).status).toBe(200);
    as(fresh);
    expect(await codeOf(m.session.requireSession())).toBe("PASSWORD_CHANGE_REQUIRED");
  });
});

describe("account lockout", () => {
  it("locks the account after repeated wrong passwords, regardless of IP", async () => {
    const { password } = await m.accounts.createAccount({
      email: "locked@school.test",
      name: "L",
      role: "student",
    });
    const { max } = m.authModule.LOGIN_FAILURE_RULE;
    for (let i = 0; i < max; i++) {
      expect((await new TestClient().signIn("locked@school.test", "nope")).status).toBe(401);
    }
    const locked = await new TestClient().signIn("locked@school.test", password);
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe("ACCOUNT_LOCKED");
  });

  it("a successful sign-in clears earlier failures", async () => {
    const { password } = await m.accounts.createAccount({
      email: "clears@school.test",
      name: "C",
      role: "student",
    });
    for (let i = 0; i < 3; i++) await new TestClient().signIn("clears@school.test", "nope");
    expect((await new TestClient().signIn("clears@school.test", password)).status).toBe(200);
    const status = await m.throttle.throttleStatus("login:clears@school.test", {
      max: 1,
      windowSeconds: 900,
    });
    expect(status.blocked).toBe(false);
  });
});

describe("privileged roles: mandatory 2FA and step-up", () => {
  const client = new TestClient();
  const newPassword = "Owner-strong-password-1";
  let userId: string;
  let totpUri: string;

  beforeAll(async () => {
    const created = await m.accounts.createAccount({
      email: "owner@school.test",
      name: "Owner",
      role: "owner",
    });
    userId = created.id;
    await client.signIn("owner@school.test", created.password);
    await client.request("POST", "/change-password", {
      currentPassword: created.password,
      newPassword,
      revokeOtherSessions: true,
    });
  });

  it("an owner without 2FA is blocked everywhere except the enrollment step", async () => {
    as(client);
    expect(await codeOf(m.session.requireSession({ area: "owner" }))).toBe("TWO_FACTOR_REQUIRED");
    expect(await codeOf(m.session.requireSession({ allowPendingTwoFactor: true }))).toBeUndefined();
  });

  it("enrolls TOTP with a standard authenticator code", async () => {
    const enable = await client.request("POST", "/two-factor/enable", { password: newPassword });
    expect(enable.status).toBe(200);
    expect(enable.body.backupCodes.length).toBeGreaterThan(0);
    totpUri = enable.body.totpURI;
    expect(totpUri).toMatch(/^otpauth:\/\/totp\//);

    // Not enabled until the first code is confirmed.
    as(client);
    expect(await codeOf(m.session.requireSession({ area: "owner" }))).toBe("TWO_FACTOR_REQUIRED");

    const verify = await client.request("POST", "/two-factor/verify-totp", { code: totpFromUri(totpUri) });
    expect(verify.status).toBe(200);
    as(client);
    const context = await m.session.requireSession({ area: "owner" });
    expect(context.user.twoFactorEnabled).toBe(true);
  });

  it("the TOTP secret is stored encrypted", async () => {
    const { db, schema } = m.dbModule;
    const [row] = await db.select().from(schema.twoFactors).where(eq(schema.twoFactors.userId, userId));
    const plainSecret = new URL(totpUri).searchParams.get("secret")!;
    expect(row.secret).not.toContain(plainSecret);
  });

  it("high-risk actions need a fresh code even while signed in", async () => {
    as(client);
    const context = await m.session.requireSession({ area: "owner" });
    expect(await codeOf(m.stepUp.requireStepUp(context))).toBe("STEP_UP_REQUIRED");

    expect(await codeOf(m.stepUp.verifyStepUp(context, wrongCode(totpFromUri(totpUri))))).toBe("VALIDATION");
    expect(await m.stepUp.hasStepUp(context)).toBe(false);

    const { expiresAt } = await m.stepUp.verifyStepUp(context, totpFromUri(totpUri));
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(m.stepUp.STEP_UP_TTL_SECONDS * 1000);
    expect(await codeOf(m.stepUp.requireStepUp(context))).toBeUndefined();
  });

  it("step-up expires", async () => {
    const { db, schema } = m.dbModule;
    as(client);
    const context = await m.session.requireSession({ area: "owner" });
    await db
      .update(schema.stepUps)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.stepUps.sessionId, context.sessionId));
    expect(await codeOf(m.stepUp.requireStepUp(context))).toBe("STEP_UP_REQUIRED");
  });

  it("step-up is bound to the session: another session of the same user has none", async () => {
    as(client);
    const first = await m.session.requireSession({ area: "owner" });
    await m.stepUp.verifyStepUp(first, totpFromUri(totpUri));

    const other = new TestClient();
    const signIn = await other.signIn("owner@school.test", newPassword);
    expect(signIn.body.twoFactorRedirect).toBe(true);
    await other.request("POST", "/two-factor/verify-totp", { code: totpFromUri(totpUri) });
    as(other);
    const second = await m.session.requireSession({ area: "owner" });
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(await codeOf(m.stepUp.requireStepUp(second))).toBe("STEP_UP_REQUIRED");
  });

  it("wrong step-up codes are capped, and the cap survives a correct code", async () => {
    as(client);
    const context = await m.session.requireSession({ area: "owner" });
    const bad = wrongCode(totpFromUri(totpUri));
    for (let i = 0; i < m.stepUp.STEP_UP_ATTEMPT_RULE.max; i++) {
      expect(await codeOf(m.stepUp.verifyStepUp(context, bad))).toBe("VALIDATION");
    }
    expect(await codeOf(m.stepUp.verifyStepUp(context, totpFromUri(totpUri)))).toBe("RATE_LIMITED");
    await m.throttle.throttleReset(`step-up:${userId}`);
  });

  it("password alone no longer signs in: the second factor is required", async () => {
    const fresh = new TestClient();
    const signIn = await fresh.signIn("owner@school.test", newPassword);
    expect(signIn.status).toBe(200);
    expect(signIn.body.twoFactorRedirect).toBe(true);
    as(fresh);
    expect(await m.session.getSessionContext()).toBeNull();

    const bad = await fresh.request("POST", "/two-factor/verify-totp", {
      code: wrongCode(totpFromUri(totpUri)),
    });
    expect(bad.status).toBe(401);
    as(fresh);
    expect(await m.session.getSessionContext()).toBeNull();

    const good = await fresh.request("POST", "/two-factor/verify-totp", { code: totpFromUri(totpUri) });
    expect(good.status).toBe(200);
    as(fresh);
    expect((await m.session.requireSession({ area: "owner" })).user.role).toBe("owner");
  });

  it("owner can open every area", async () => {
    as(client);
    for (const area of ["owner", "manager", "admin", "teacher", "student"] as const) {
      expect(await codeOf(m.session.requireSession({ area }))).toBeUndefined();
    }
  });
});

describe("school admin", () => {
  it("regression: a school admin cannot enter the manager or owner areas", async () => {
    const created = await m.accounts.createAccount({
      email: "admin@school.test",
      name: "Admin",
      role: "admin",
    });
    const client = new TestClient();
    await client.signIn("admin@school.test", created.password);
    as(client);
    const pending = { allowPendingPasswordChange: true, allowPendingTwoFactor: true };
    expect(await codeOf(m.session.requireSession({ area: "admin", ...pending }))).toBeUndefined();
    expect(await codeOf(m.session.requireSession({ area: "manager", ...pending }))).toBe("FORBIDDEN");
    expect(await codeOf(m.session.requireSession({ area: "owner", ...pending }))).toBe("FORBIDDEN");
  });
});
