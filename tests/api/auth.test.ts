import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

// TOTP codes change every 30 s and each one may only be used once, so the tests move a
// fake clock forward to get a fresh code instead of sleeping.
const freshCode = (totpUri: string) => {
  vi.setSystemTime(Date.now() + 30_000);
  return totpFromUri(totpUri);
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
  guards: await import("@/server/auth/guards"),
  dbModule: await import("@/server/db"),
});
let m: Awaited<ReturnType<typeof load>>;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"], now: Date.now() });
  await resetDatabase();
  m = await load();
});
afterAll(() => {
  vi.useRealTimers();
});

/** Creates an account and signs it in with a changed password, ready for normal use. */
async function readyAccount(email: string, role: "student" | "owner" | "manager" | "admin", ip?: string) {
  const created = await m.accounts.createAccount({ email, name: email.split("@")[0], role });
  const client = new TestClient(ip);
  await client.signIn(email, created.password);
  const password = `${created.password}-changed`;
  await client.request("POST", "/change-password", {
    currentPassword: created.password,
    newPassword: password,
    revokeOtherSessions: true,
  });
  return { id: created.id, client, password };
}

/** Enrolls TOTP for a signed-in client and returns the otpauth URI. */
async function enroll(client: TestClient, password: string): Promise<string> {
  const enable = await client.request("POST", "/two-factor/enable", { password });
  expect(enable.status).toBe(200);
  const uri: string = enable.body.totpURI;
  const verify = await client.request("POST", "/two-factor/verify-totp", { code: freshCode(uri) });
  expect(verify.status).toBe(200);
  return uri;
}

describe("account creation", () => {
  it("rejects emails outside the allowed domain, malformed emails and duplicates", async () => {
    for (const email of ["x@gmail.com", "@school.test", "ali hassan@school.test", "علي@school.test"]) {
      expect(await codeOf(m.accounts.createAccount({ email, name: "X", role: "student" })), email).toBe(
        "VALIDATION",
      );
    }
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
    const response = await new TestClient().request("POST", "/sign-up/email", {
      email: "intruder@school.test",
      password: "Password123!",
      name: "Intruder",
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    const [row] = await m.dbModule.db
      .select()
      .from(m.dbModule.schema.users)
      .where(eq(m.dbModule.schema.users.email, "intruder@school.test"));
    expect(row).toBeUndefined();
  });

  it("regression: users cannot rename themselves or set an arbitrary avatar URL", async () => {
    const { client, id } = await readyAccount("rename@school.test", "student");
    const response = await client.request("POST", "/update-user", {
      name: "A Teacher",
      image: "https://attacker.example/pixel.png",
    });
    expect(response.status).toBe(404);
    const [user] = await m.dbModule.db
      .select()
      .from(m.dbModule.schema.users)
      .where(eq(m.dbModule.schema.users.id, id));
    expect(user.name).toBe("rename");
    expect(user.image).toBeNull();
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

  it("sign-in records last login and a UTC-stamped analytics event", async () => {
    const { db, schema } = m.dbModule;
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(user.lastLoginAt).toBeInstanceOf(Date);
    const events = await db
      .select()
      .from(schema.analyticsEvents)
      .where(eq(schema.analyticsEvents.userId, userId));
    const login = events.find((e) => e.eventType === "login");
    expect(login).toBeDefined();
    expect(Math.abs(login!.createdAt.getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("regression: 'changing' to the same temporary password does not count", async () => {
    const same = await client.request("POST", "/change-password", {
      currentPassword: password,
      newPassword: password,
    });
    expect(same.status).toBe(400);
    expect(same.body.code).toBe("SAME_PASSWORD");
    as(client);
    expect(await codeOf(m.session.requireSession())).toBe("PASSWORD_CHANGE_REQUIRED");
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

describe("sign-in lockout", () => {
  const { LOGIN_PAIR_RULE, LOGIN_ACCOUNT_RULE } = {
    LOGIN_PAIR_RULE: { max: 8 },
    LOGIN_ACCOUNT_RULE: { max: 50 },
  };

  it("rule values are what these tests assume", () => {
    expect(m.throttle.LOGIN_PAIR_RULE.max).toBe(LOGIN_PAIR_RULE.max);
    expect(m.throttle.LOGIN_ACCOUNT_RULE.max).toBe(LOGIN_ACCOUNT_RULE.max);
  });

  it("locks the account for the attacking IP only; the owner can still sign in from elsewhere", async () => {
    const { password } = await m.accounts.createAccount({
      email: "pair@school.test",
      name: "P",
      role: "student",
    });
    for (let i = 0; i < LOGIN_PAIR_RULE.max; i++) {
      expect((await new TestClient("198.51.100.1").signIn("pair@school.test", "nope")).status).toBe(401);
    }
    const sameIp = await new TestClient("198.51.100.1").signIn("pair@school.test", password);
    expect(sameIp.status).toBe(429);
    expect(sameIp.body.code).toBe("ACCOUNT_LOCKED");
    expect((await new TestClient("198.51.100.2").signIn("pair@school.test", password)).status).toBe(200);
  });

  it("a distributed attack across many IPs hits the per-account ceiling", async () => {
    const { password } = await m.accounts.createAccount({
      email: "spread@school.test",
      name: "S",
      role: "student",
    });
    for (let i = 0; i < LOGIN_ACCOUNT_RULE.max; i++) {
      await new TestClient(`192.0.2.${i + 1}`).signIn("spread@school.test", "nope");
    }
    const anywhere = await new TestClient("198.51.100.99").signIn("spread@school.test", password);
    expect(anywhere.status).toBe(429);
  });

  it("regression: a parallel burst cannot test more passwords than the limit", async () => {
    await m.accounts.createAccount({ email: "burst@school.test", name: "B", role: "student" });
    const results = await Promise.all(
      Array.from({ length: 20 }, () => new TestClient("198.51.100.50").signIn("burst@school.test", "nope")),
    );
    const checked = results.filter((r) => r.status === 401).length;
    const refused = results.filter((r) => r.status === 429).length;
    expect(checked).toBeLessThanOrEqual(LOGIN_PAIR_RULE.max);
    expect(checked + refused).toBe(20);
  });

  it("a successful sign-in clears earlier failures", async () => {
    const { password } = await m.accounts.createAccount({
      email: "clears@school.test",
      name: "C",
      role: "student",
    });
    for (let i = 0; i < 5; i++) await new TestClient().signIn("clears@school.test", "nope");
    expect((await new TestClient().signIn("clears@school.test", password)).status).toBe(200);
    for (let i = 0; i < 5; i++) {
      expect((await new TestClient().signIn("clears@school.test", "nope")).status).toBe(401);
    }
  });

  it("a staff password reset unlocks the account", async () => {
    const { id } = await m.accounts.createAccount({
      email: "unlock@school.test",
      name: "U",
      role: "student",
    });
    for (let i = 0; i <= LOGIN_PAIR_RULE.max; i++)
      await new TestClient().signIn("unlock@school.test", "nope");
    const temporary = await m.accounts.resetPassword(id);
    expect((await new TestClient().signIn("unlock@school.test", temporary)).status).toBe(200);
  });

  it("regression: a session holder can't brute-force the password through other endpoints", async () => {
    const { client } = await readyAccount("guess@school.test", "student");
    const { max } = m.guards.PASSWORD_ATTEMPT_RULE;
    for (let i = 0; i < max; i++) {
      const wrong = await client.request("POST", "/change-password", {
        currentPassword: `guess-${i}`,
        newPassword: "Another-password-1",
      });
      expect(wrong.status).toBe(400);
    }
    const blocked = await client.request("POST", "/change-password", {
      currentPassword: "guess-final",
      newPassword: "Another-password-1",
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("PASSWORD_ATTEMPTS_EXCEEDED");
  });
});

describe("privileged roles: mandatory 2FA and step-up", () => {
  let owner: Awaited<ReturnType<typeof readyAccount>>;
  let totpUri: string;

  beforeAll(async () => {
    owner = await readyAccount("owner@school.test", "owner");
  });

  it("an owner without 2FA is blocked everywhere except the enrollment step", async () => {
    as(owner.client);
    expect(await codeOf(m.session.requireSession({ area: "owner" }))).toBe("TWO_FACTOR_REQUIRED");
    expect(await codeOf(m.session.requireSession({ allowPendingTwoFactor: true }))).toBeUndefined();
  });

  it("enrolls TOTP with a standard authenticator code", async () => {
    const enable = await owner.client.request("POST", "/two-factor/enable", { password: owner.password });
    expect(enable.status).toBe(200);
    expect(enable.body.backupCodes.length).toBeGreaterThan(0);
    totpUri = enable.body.totpURI;
    expect(totpUri).toMatch(/^otpauth:\/\/totp\//);

    // Not enabled until the first code is confirmed.
    as(owner.client);
    expect(await codeOf(m.session.requireSession({ area: "owner" }))).toBe("TWO_FACTOR_REQUIRED");

    const verify = await owner.client.request("POST", "/two-factor/verify-totp", {
      code: freshCode(totpUri),
    });
    expect(verify.status).toBe(200);
    as(owner.client);
    expect((await m.session.requireSession({ area: "owner" })).user.twoFactorEnabled).toBe(true);
  });

  it("the TOTP secret is stored encrypted", async () => {
    const { db, schema } = m.dbModule;
    const [row] = await db.select().from(schema.twoFactors).where(eq(schema.twoFactors.userId, owner.id));
    expect(row.secret).not.toContain(new URL(totpUri).searchParams.get("secret")!);
  });

  it("regression: signed-in users can't test codes on the raw verify endpoint", async () => {
    for (const code of [wrongCode(totpFromUri(totpUri)), freshCode(totpUri)]) {
      const response = await owner.client.request("POST", "/two-factor/verify-totp", { code });
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("USE_STEP_UP");
    }
  });

  it("high-risk actions need a fresh code even while signed in", async () => {
    as(owner.client);
    const context = await m.session.requireSession({ area: "owner" });
    expect(await codeOf(m.stepUp.requireStepUp(context))).toBe("STEP_UP_REQUIRED");

    expect(await codeOf(m.stepUp.verifyStepUp(context, wrongCode(freshCode(totpUri))))).toBe("VALIDATION");
    expect(await m.stepUp.hasStepUp(context)).toBe(false);

    const { expiresAt } = await m.stepUp.verifyStepUp(context, freshCode(totpUri));
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(m.stepUp.STEP_UP_TTL_SECONDS * 1000);
    expect(await codeOf(m.stepUp.requireStepUp(context))).toBeUndefined();
  });

  it("regression: a code can't be used twice", async () => {
    as(owner.client);
    const context = await m.session.requireSession({ area: "owner" });
    const code = freshCode(totpUri);
    await m.stepUp.verifyStepUp(context, code);
    expect(await codeOf(m.stepUp.verifyStepUp(context, code))).toBe("VALIDATION");
  });

  it("regression: the code typed at sign-in can't be replayed for step-up", async () => {
    const other = new TestClient();
    await other.signIn("owner@school.test", owner.password);
    const code = freshCode(totpUri);
    expect((await other.request("POST", "/two-factor/verify-totp", { code })).status).toBe(200);
    as(other);
    const context = await m.session.requireSession({ area: "owner" });
    expect(await codeOf(m.stepUp.verifyStepUp(context, code))).toBe("VALIDATION");
    expect(await m.stepUp.hasStepUp(context)).toBe(false);
  });

  it("step-up expires", async () => {
    const { db, schema } = m.dbModule;
    as(owner.client);
    const context = await m.session.requireSession({ area: "owner" });
    await m.stepUp.verifyStepUp(context, freshCode(totpUri));
    expect(await m.stepUp.hasStepUp(context)).toBe(true);
    vi.setSystemTime(Date.now() + (m.stepUp.STEP_UP_TTL_SECONDS + 1) * 1000);
    expect(await codeOf(m.stepUp.requireStepUp(context))).toBe("STEP_UP_REQUIRED");
    const rows = await db
      .select()
      .from(schema.stepUps)
      .where(eq(schema.stepUps.sessionId, context.sessionId));
    expect(rows).toHaveLength(1); // still there, just expired
  });

  it("step-up is bound to the session: another session of the same user has none", async () => {
    as(owner.client);
    const first = await m.session.requireSession({ area: "owner" });
    await m.stepUp.verifyStepUp(first, freshCode(totpUri));

    const other = new TestClient();
    expect((await other.signIn("owner@school.test", owner.password)).body.twoFactorRedirect).toBe(true);
    await other.request("POST", "/two-factor/verify-totp", { code: freshCode(totpUri) });
    as(other);
    const second = await m.session.requireSession({ area: "owner" });
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(await codeOf(m.stepUp.requireStepUp(second))).toBe("STEP_UP_REQUIRED");
  });

  it("signing out removes the step-up grant", async () => {
    const other = new TestClient();
    await other.signIn("owner@school.test", owner.password);
    await other.request("POST", "/two-factor/verify-totp", { code: freshCode(totpUri) });
    as(other);
    const context = await m.session.requireSession({ area: "owner" });
    await m.stepUp.verifyStepUp(context, freshCode(totpUri));
    expect((await other.request("POST", "/sign-out", {})).status).toBe(200);
    const { db, schema } = m.dbModule;
    const rows = await db
      .select()
      .from(schema.stepUps)
      .where(eq(schema.stepUps.sessionId, context.sessionId));
    expect(rows).toHaveLength(0);
  });

  it("wrong step-up codes are capped, and the cap holds even against a correct code", async () => {
    as(owner.client);
    const context = await m.session.requireSession({ area: "owner" });
    for (let i = 0; i < m.stepUp.STEP_UP_ATTEMPT_RULE.max; i++) {
      expect(await codeOf(m.stepUp.verifyStepUp(context, wrongCode(totpFromUri(totpUri))))).toBe(
        "VALIDATION",
      );
    }
    expect(await codeOf(m.stepUp.verifyStepUp(context, freshCode(totpUri)))).toBe("RATE_LIMITED");
    await m.throttle.throttleReset(m.stepUp.stepUpAttemptKey(owner.id));
  });

  it("regression: parallel step-up guesses can't exceed the cap", async () => {
    as(owner.client);
    const context = await m.session.requireSession({ area: "owner" });
    const bad = wrongCode(freshCode(totpUri));
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        codeOf(m.stepUp.verifyStepUp(context, `${bad.slice(0, 5)}${i % 10}`)),
      ),
    );
    const evaluated = results.filter((c) => c === "VALIDATION").length;
    expect(evaluated).toBeLessThanOrEqual(m.stepUp.STEP_UP_ATTEMPT_RULE.max);
    expect(results.filter((c) => c === "RATE_LIMITED").length).toBe(15 - evaluated);
    await m.throttle.throttleReset(m.stepUp.stepUpAttemptKey(owner.id));
  });

  it("password alone no longer signs in, and 'trust this device' is ignored", async () => {
    const fresh = new TestClient();
    const signIn = await fresh.signIn("owner@school.test", owner.password);
    expect(signIn.status).toBe(200);
    expect(signIn.body.twoFactorRedirect).toBe(true);
    as(fresh);
    expect(await m.session.getSessionContext()).toBeNull();

    const bad = await fresh.request("POST", "/two-factor/verify-totp", {
      code: wrongCode(totpFromUri(totpUri)),
    });
    expect(bad.status).toBe(401);

    const good = await fresh.request("POST", "/two-factor/verify-totp", {
      code: freshCode(totpUri),
      trustDevice: true,
    });
    expect(good.status).toBe(200);
    expect(fresh.hasCookie("trust_device")).toBe(false);
    as(fresh);
    expect((await m.session.requireSession({ area: "owner" })).user.role).toBe("owner");

    // Next sign-in from the same browser still asks for a code.
    expect((await fresh.signIn("owner@school.test", owner.password)).body.twoFactorRedirect).toBe(true);
  });

  it("owner can open every area", async () => {
    as(owner.client);
    for (const area of ["owner", "manager", "admin", "teacher", "student"] as const) {
      expect(await codeOf(m.session.requireSession({ area }))).toBeUndefined();
    }
  });
});

describe("authenticator management needs step-up", () => {
  let manager: Awaited<ReturnType<typeof readyAccount>>;
  let totpUri: string;

  beforeAll(async () => {
    manager = await readyAccount("manager@school.test", "manager");
    totpUri = await enroll(manager.client, manager.password);
  });

  it("regression: the password alone can't reveal, replace or remove the authenticator", async () => {
    for (const path of ["/two-factor/get-totp-uri", "/two-factor/disable", "/two-factor/enable"]) {
      const response = await manager.client.request("POST", path, { password: manager.password });
      expect(response.status, path).toBe(403);
      expect(response.body.code, path).toBe("STEP_UP_REQUIRED");
    }
    as(manager.client);
    expect((await m.session.requireSession({ area: "manager" })).user.twoFactorEnabled).toBe(true);
  });

  it("with a fresh code it works, and disabling sends the user back to enrollment", async () => {
    as(manager.client);
    const context = await m.session.requireSession({ area: "manager" });
    await m.stepUp.verifyStepUp(context, freshCode(totpUri));
    const disabled = await manager.client.request("POST", "/two-factor/disable", {
      password: manager.password,
    });
    expect(disabled.status).toBe(200);
    as(manager.client);
    expect(await codeOf(m.session.requireSession({ area: "manager" }))).toBe("TWO_FACTOR_REQUIRED");
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

describe("database invariants", () => {
  it("connections run in UTC regardless of the server's time zone", async () => {
    const [rows] = (await m.dbModule.db.execute(sql`SELECT NOW(3) AS now`)) as unknown as [{ now: string }[]];
    const dbNow = new Date(`${String(rows[0].now).replace(" ", "T")}Z`).getTime();
    expect(Math.abs(dbNow - vi.getRealSystemTime())).toBeLessThan(10_000);
  });

  it("regression: deleting a teacher who authored homework fails instead of erasing students' work", async () => {
    const { db, schema } = m.dbModule;
    const schoolId = crypto.randomUUID();
    await db.insert(schema.schools).values({ id: schoolId, name: "School" });
    const teacher = await m.accounts.createAccount({
      email: "teacher@school.test",
      name: "Teacher",
      role: "teacher",
      schoolId,
    });
    await db.insert(schema.homework).values({ teacherId: teacher.id, schoolId, grade: "5", title: "HW" });
    await expect(db.delete(schema.users).where(eq(schema.users.id, teacher.id))).rejects.toThrow();
    const remaining = await db
      .select()
      .from(schema.homework)
      .where(eq(schema.homework.teacherId, teacher.id));
    expect(remaining).toHaveLength(1);
  });
});
