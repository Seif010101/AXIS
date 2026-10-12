"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { verifyStepUpAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { CodeInput } from "./code-input";

/** The "confirm it's you" dialog. Rendered once by <StepUpProvider/>; do not mount it yourself. */
export function StepUpDialog({
  open,
  twoFactorEnabled,
  onVerified,
  onCancel,
}: {
  open: boolean;
  twoFactorEnabled: boolean;
  onVerified: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("shell.stepUp");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const inputId = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setCode("");
    setError(null);
  };

  const submit = (value: string) => {
    if (value.length !== 6 || pending) return;
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof verifyStepUpAction>>;
      try {
        result = await verifyStepUpAction({ code: value });
      } catch {
        setError(tCommon("errors.NETWORK"));
        return;
      }
      if (result.ok) {
        reset();
        onVerified();
        return;
      }
      if (result.code === "UNAUTHENTICATED") {
        router.replace("/login");
        return;
      }
      setCode("");
      setError(
        result.code === "VALIDATION"
          ? t("invalid")
          : result.code === "RATE_LIMITED"
            ? t("tooMany")
            : tCommon("errors.INTERNAL"),
      );
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) {
          reset();
          onCancel();
        }
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-6" aria-hidden />
          </span>
          <DialogTitle className="text-lg">{t("title")}</DialogTitle>
          <DialogDescription>{twoFactorEnabled ? t("description") : t("needsTwoFactor")}</DialogDescription>
        </DialogHeader>

        {twoFactorEnabled ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit(code);
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              {t("codeLabel")}
            </label>
            <CodeInput
              id={inputId}
              value={code}
              onChange={(value) => {
                setCode(value);
                if (error) setError(null);
              }}
              onComplete={submit}
              disabled={pending}
              invalid={Boolean(error)}
            />
            <p role="alert" aria-live="polite" className="min-h-5 text-center text-sm text-destructive">
              {error}
            </p>
            <DialogFooter className="gap-2 sm:justify-center">
              <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={pending}>
                {tCommon("actions.cancel")}
              </Button>
              <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
                {pending && <Spinner data-icon="inline-start" aria-hidden />}
                {t("verify")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <DialogFooter className="gap-2 sm:justify-center">
            <Button type="button" variant="outline" size="lg" onClick={onCancel}>
              {tCommon("actions.cancel")}
            </Button>
            <Button asChild size="lg">
              <Link href="/setup-2fa" onClick={onCancel}>
                {t("setUp")}
              </Link>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
