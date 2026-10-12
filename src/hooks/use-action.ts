"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStepUp } from "@/components/auth/step-up-provider";
import { callAction, errorMessageKey, type ActionFailure, type ActionOutcome } from "@/lib/action-result";
import type { ActionResult } from "@/server/action";

export type { ActionFailure, ActionOutcome };

export interface UseActionOptions<T> {
  /** Toast shown after a successful call (already translated). */
  successMessage?: string;
  onSuccess?: (data: T) => void;
  onError?: (failure: ActionFailure) => void;
  /** Don't show the automatic error toast (the caller renders the error itself). */
  silent?: boolean;
}

/**
 * Runs a server action written with action() (src/server/action.ts) from a client component.
 *
 * - Shows a localized toast for failures (common.errors.<CODE>, INTERNAL for unknown codes).
 * - UNAUTHENTICATED sends the user to /login.
 * - STEP_UP_REQUIRED opens the step-up dialog and retries the action once after a valid code.
 *
 * @example
 * const { execute, pending, fieldErrors } = useAction(saveProfileAction, { successMessage: t("saved") });
 * await execute({ image: "preset:ocean" });
 */
export function useAction<I, O>(
  serverAction: (input: I) => Promise<ActionResult<O>>,
  options: UseActionOptions<O> = {},
) {
  const t = useTranslations("common.errors");
  const router = useRouter();
  const { requestStepUp } = useStepUp();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();

  // Callers usually pass a fresh options object every render; read the latest one.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const execute = useCallback(
    async (input: I): Promise<ActionOutcome<O>> => {
      setPending(true);
      setFieldErrors(undefined);
      try {
        let result = await callAction(serverAction, input);
        let stepUpDeclined = false;
        if (!result.ok && result.code === "STEP_UP_REQUIRED") {
          if (await requestStepUp()) result = await callAction(serverAction, input);
          else stepUpDeclined = true;
        }

        const { successMessage, onSuccess, onError, silent } = optionsRef.current;
        if (result.ok) {
          if (successMessage) toast.success(successMessage);
          onSuccess?.(result.data);
          return result;
        }

        setFieldErrors(result.fieldErrors);
        if (result.code === "UNAUTHENTICATED") router.replace("/login");
        if (!silent && !stepUpDeclined) {
          toast.error(t(errorMessageKey(result.code, (code): code is ActionFailure["code"] => t.has(code as ActionFailure["code"]))));
        }
        onError?.(result);
        return result;
      } finally {
        setPending(false);
      }
    },
    [serverAction, requestStepUp, router, t],
  );

  return { execute, pending, fieldErrors };
}
