import { describe, expect, it } from "vitest";
import {
  codeErrorKey,
  isStepUpRequired,
  passwordErrorKey,
  passwordStrength,
  signInErrorKey,
} from "@/lib/auth-errors";

describe("sign-in errors", () => {
  it("maps the server's codes to precise messages", () => {
    expect(signInErrorKey({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" })).toBe("invalidCredentials");
    expect(signInErrorKey({ status: 429, code: "ACCOUNT_LOCKED" })).toBe("accountLocked");
    expect(signInErrorKey({ status: 403, code: "ACCOUNT_DISABLED" })).toBe("accountDisabled");
    expect(signInErrorKey({ status: 429 })).toBe("rateLimited");
    expect(signInErrorKey({ status: 403, code: "BOT_CHECK_FAILED" })).toBe("botCheckFailed");
    expect(signInErrorKey({ status: 503, code: "BOT_CHECK_UNAVAILABLE" })).toBe("botCheckUnavailable");
    expect(signInErrorKey({ status: 0 })).toBe("network");
    expect(signInErrorKey({})).toBe("network");
    expect(signInErrorKey({ status: 500, code: "SOMETHING" })).toBe("unknown");
    expect(signInErrorKey(null)).toBe("unknown");
  });
});

describe("code errors", () => {
  it("distinguishes wrong codes, lockouts and an expired sign-in step", () => {
    expect(codeErrorKey({ status: 401, code: "INVALID_CODE" })).toBe("invalidCode");
    expect(codeErrorKey({ status: 401, code: "INVALID_BACKUP_CODE" })).toBe("invalidBackupCode");
    expect(codeErrorKey({ status: 429, code: "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" })).toBe("tooManyAttempts");
    expect(codeErrorKey({ status: 429 })).toBe("tooManyAttempts");
    expect(codeErrorKey({ status: 401, code: "INVALID_TWO_FACTOR_COOKIE" })).toBe("expired");
    expect(codeErrorKey({ status: 401 })).toBe("expired");
    expect(codeErrorKey({ status: 500 })).toBe("unknown");
  });
});

describe("password errors", () => {
  it("maps password checks and the attempt limit", () => {
    expect(passwordErrorKey({ status: 400, code: "INVALID_PASSWORD" })).toBe("wrongPassword");
    expect(passwordErrorKey({ status: 400, code: "SAME_PASSWORD" })).toBe("samePassword");
    expect(passwordErrorKey({ status: 400, code: "PASSWORD_TOO_SHORT" })).toBe("tooShort");
    expect(passwordErrorKey({ status: 400, code: "PASSWORD_TOO_LONG" })).toBe("tooLong");
    expect(passwordErrorKey({ status: 429, code: "PASSWORD_ATTEMPTS_EXCEEDED" })).toBe("tooManyAttempts");
    expect(passwordErrorKey({ status: 429 })).toBe("tooManyAttempts");
    expect(passwordErrorKey(undefined)).toBe("unknown");
  });

  it("recognizes a missing step-up", () => {
    expect(isStepUpRequired({ status: 403, code: "STEP_UP_REQUIRED" })).toBe(true);
    expect(isStepUpRequired({ status: 403, code: "FORBIDDEN" })).toBe(false);
    expect(isStepUpRequired(null)).toBe(false);
  });
});

describe("password strength guidance", () => {
  it("scores length and variety", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("Ab1!")).toBe(0);
    expect(passwordStrength("abcdefgh")).toBe(1);
    expect(passwordStrength("abcdefghijkl")).toBe(2);
    expect(passwordStrength("Abcdefgh1")).toBe(2);
    expect(passwordStrength("Abcdefgh1!xy")).toBe(4);
    expect(passwordStrength("correct horse battery")).toBe(3);
  });
});
