"use client";

import { KeyRound, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { AuthError } from "@/components/auth/auth-heading";
import { CodeInput } from "@/components/auth/code-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { codeErrorKey, type CodeErrorKey } from "@/lib/auth-errors";
import { completeSignInAction } from "../actions";

type Mode = "authenticator" | "backup";

/** Second sign-in step: a 6-digit authenticator code, or one backup code. */
export function TwoFactorForm() {
  const t = useTranslations("auth.twoFactor");
  const router = useRouter();
  const codeId = useId();
  const backupId = useId();
  const [mode, setMode] = useState<Mode>("authenticator");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState<CodeErrorKey | "network" | null>(null);
  const [pending, setPending] = useState(false);

  const verify = async (value: string, kind: Mode) => {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const { error: verifyError } =
        kind === "authenticator"
          ? await authClient.twoFactor.verifyTotp({ code: value })
          : await authClient.twoFactor.verifyBackupCode({ code: value.trim() });
      if (verifyError) {
        setError(codeErrorKey(verifyError));
        setCode("");
        setPending(false);
        return;
      }
      const result = await completeSignInAction({});
      router.replace(result.ok ? result.data.next : "/");
      router.refresh();
    } catch {
      setError("network");
      setPending(false);
    }
  };

  const submitBackup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (backupCode.trim()) void verify(backupCode, "backup");
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const message = error && t(`errors.${error}`);

  return (
    <div className="space-y-5">
      <AuthError>
        {message}
        {error === "expired" && (
          <>
            {" "}
            <Link href="/login" className="font-medium underline underline-offset-4">
              {t("backToLogin")}
            </Link>
          </>
        )}
      </AuthError>

      {mode === "authenticator" ? (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.length === 6) void verify(code, "authenticator");
          }}
        >
          <div className="space-y-3">
            <Label htmlFor={codeId} className="justify-center">
              {t("codeLabel")}
            </Label>
            <CodeInput
              id={codeId}
              value={code}
              onChange={(value) => {
                setCode(value);
                if (error) setError(null);
              }}
              onComplete={(value) => void verify(value, "authenticator")}
              disabled={pending}
              invalid={error === "invalidCode"}
            />
          </div>
          <Button type="submit" size="lg" className="h-10 w-full" disabled={pending || code.length !== 6}>
            {pending && <Spinner data-icon="inline-start" aria-hidden />}
            {t("verify")}
          </Button>
          <Button type="button" variant="link" className="w-full" onClick={() => switchMode("backup")}>
            <KeyRound data-icon="inline-start" aria-hidden />
            {t("useBackup")}
          </Button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={submitBackup}>
          <div className="space-y-2">
            <Label htmlFor={backupId}>{t("backupLabel")}</Label>
            <Input
              id={backupId}
              value={backupCode}
              onChange={(event) => setBackupCode(event.target.value)}
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              dir="ltr"
              autoFocus
              placeholder={t("backupPlaceholder")}
              className="h-10 text-center font-mono tracking-wider"
              aria-invalid={error === "invalidBackupCode" || undefined}
            />
            <p className="text-xs text-muted-foreground">{t("backupHint")}</p>
          </div>
          <Button type="submit" size="lg" className="h-10 w-full" disabled={pending || !backupCode.trim()}>
            {pending && <Spinner data-icon="inline-start" aria-hidden />}
            {t("verify")}
          </Button>
          <Button type="button" variant="link" className="w-full" onClick={() => switchMode("authenticator")}>
            <Smartphone data-icon="inline-start" aria-hidden />
            {t("useAuthenticator")}
          </Button>
        </form>
      )}
    </div>
  );
}
