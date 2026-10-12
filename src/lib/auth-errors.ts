// Maps Better Auth client errors ({ status, code }) to the localized message keys used by
// the auth screens. Pure, so it is unit-tested (tests/unit/auth-errors.test.ts).

export interface AuthClientError {
  status?: number;
  code?: string;
}

export type SignInErrorKey =
  | "invalidCredentials"
  | "accountLocked"
  | "accountDisabled"
  | "rateLimited"
  | "network"
  | "unknown";

export function signInErrorKey(error: AuthClientError | null | undefined): SignInErrorKey {
  if (!error) return "unknown";
  if (error.code === "ACCOUNT_LOCKED") return "accountLocked";
  if (error.code === "ACCOUNT_DISABLED") return "accountDisabled";
  if (error.status === 429) return "rateLimited";
  if (error.code === "INVALID_EMAIL_OR_PASSWORD" || error.code === "INVALID_EMAIL" || error.status === 401) {
    return "invalidCredentials";
  }
  if (error.status === 0 || error.status === undefined) return "network";
  return "unknown";
}

export type CodeErrorKey = "invalidCode" | "invalidBackupCode" | "tooManyAttempts" | "expired" | "unknown";

/** Errors of the second sign-in step and of first-code verification during enrollment. */
export function codeErrorKey(error: AuthClientError | null | undefined): CodeErrorKey {
  if (!error) return "unknown";
  switch (error.code) {
    case "INVALID_CODE":
      return "invalidCode";
    case "INVALID_BACKUP_CODE":
      return "invalidBackupCode";
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
    case "ACCOUNT_TEMPORARILY_LOCKED":
      return "tooManyAttempts";
    case "INVALID_TWO_FACTOR_COOKIE":
      return "expired";
  }
  if (error.status === 429) return "tooManyAttempts";
  if (error.status === 401) return "expired";
  return "unknown";
}

export type PasswordErrorKey =
  | "wrongPassword"
  | "samePassword"
  | "tooShort"
  | "tooLong"
  | "tooManyAttempts"
  | "unknown";

/** Errors of endpoints that check the current password (change password, 2FA setup). */
export function passwordErrorKey(error: AuthClientError | null | undefined): PasswordErrorKey {
  switch (error?.code) {
    case "INVALID_PASSWORD":
      return "wrongPassword";
    case "SAME_PASSWORD":
      return "samePassword";
    case "PASSWORD_TOO_SHORT":
      return "tooShort";
    case "PASSWORD_TOO_LONG":
      return "tooLong";
    case "PASSWORD_ATTEMPTS_EXCEEDED":
      return "tooManyAttempts";
  }
  if (error?.status === 429) return "tooManyAttempts";
  return "unknown";
}

/** True when a Better Auth call or a server action was refused for lack of a fresh step-up. */
export function isStepUpRequired(error: AuthClientError | null | undefined): boolean {
  return error?.code === "STEP_UP_REQUIRED";
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

/**
 * A rough strength score for the guidance meter (0 = too short … 4 = strong). It only
 * guides the user; the server's rules (8–128 characters, not the same) are what count.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return 0;
  let variety = 0;
  if (/[a-z]/.test(password)) variety++;
  if (/[A-Z]/.test(password)) variety++;
  if (/\d/.test(password)) variety++;
  if (/[^A-Za-z0-9]/.test(password)) variety++;
  let score = 1;
  if (password.length >= 12) score++;
  if (variety >= 3) score++;
  if (password.length >= 16 || (variety === 4 && password.length >= 12)) score++;
  return Math.min(score, 4) as PasswordStrength;
}
