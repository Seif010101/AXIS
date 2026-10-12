import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const TWO_FACTOR_PATH = "/two-factor";

// The sign-in form registers its router here so the second step opens as a client-side
// navigation (see registerAuthNavigation).
let navigate: ((href: string) => void) | null = null;

/**
 * Lets the mounted sign-in screen handle Better Auth's "two-factor required" redirect.
 * Returns the cleanup for useEffect.
 */
export function registerAuthNavigation(push: (href: string) => void): () => void {
  navigate = push;
  return () => {
    if (navigate === push) navigate = null;
  };
}

/**
 * Better Auth's browser client (same origin, /api/auth). Use it for sign-in, sign-out,
 * password change and authenticator setup; everything else goes through server actions.
 * Calls that touch the authenticator may answer 403 STEP_UP_REQUIRED: wrap them with
 * `withStepUp()` from useStepUp() (components/auth/step-up-provider.tsx).
 */
export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      // Accounts with 2FA on (always the case for privileged roles) finish on /two-factor.
      onTwoFactorRedirect() {
        navigate?.(TWO_FACTOR_PATH);
      },
    }),
  ],
});
