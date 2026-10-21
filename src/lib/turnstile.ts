// Shared by the sign-in form and the server check (src/server/auth/turnstile.ts).

/** The browser sends the Turnstile token in this header (Better Auth validates the JSON body). */
export const TURNSTILE_HEADER = "x-turnstile-token";
/** The `action` the sign-in widget renders with; the server rejects tokens for any other. */
export const TURNSTILE_LOGIN_ACTION = "login";
