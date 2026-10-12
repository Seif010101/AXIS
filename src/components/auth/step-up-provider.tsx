"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { isStepUpRequired, type AuthClientError } from "@/lib/auth-errors";
import { StepUpDialog } from "./step-up-dialog";

interface StepUpContextValue {
  /** Opens the step-up dialog; resolves true once a code was verified, false if dismissed. */
  requestStepUp: () => Promise<boolean>;
}

// Outside the signed-in app (no provider) step-up is simply unavailable.
const StepUpContext = createContext<StepUpContextValue>({ requestStepUp: async () => false });

/**
 * Mounted once by the (app) layout. Owns the single step-up dialog so any component can
 * ask for a fresh authenticator code (useAction() does it automatically).
 */
export function StepUpProvider({
  twoFactorEnabled,
  children,
}: {
  twoFactorEnabled: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pending = useRef<{ promise: Promise<boolean>; resolve: (verified: boolean) => void } | null>(null);

  const requestStepUp = useCallback(() => {
    // Concurrent requests share one dialog and one answer.
    if (pending.current) return pending.current.promise;
    let resolve: (verified: boolean) => void = () => {};
    const promise = new Promise<boolean>((r) => {
      resolve = r;
    });
    pending.current = { promise, resolve };
    setOpen(true);
    return promise;
  }, []);

  const settle = useCallback((verified: boolean) => {
    pending.current?.resolve(verified);
    pending.current = null;
    setOpen(false);
  }, []);

  const value = useMemo(() => ({ requestStepUp }), [requestStepUp]);

  return (
    <StepUpContext value={value}>
      {children}
      <StepUpDialog
        open={open}
        twoFactorEnabled={twoFactorEnabled}
        onVerified={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </StepUpContext>
  );
}

/**
 * Step-up helpers for client components.
 *
 * - `requestStepUp()` opens the dialog directly.
 * - `withStepUp(call)` runs a Better Auth client call (`{ data, error }` result); when it
 *   fails with 403 STEP_UP_REQUIRED it asks for a code and retries the call once.
 *
 * @example
 * const { withStepUp } = useStepUp();
 * const { data, error } = await withStepUp(() => authClient.twoFactor.generateBackupCodes({ password }));
 */
export function useStepUp() {
  const { requestStepUp } = useContext(StepUpContext);
  const withStepUp = useCallback(
    async <T extends { error: AuthClientError | null }>(call: () => Promise<T>): Promise<T> => {
      const first = await call();
      if (!isStepUpRequired(first.error)) return first;
      return (await requestStepUp()) ? call() : first;
    },
    [requestStepUp],
  );
  return { requestStepUp, withStepUp };
}
