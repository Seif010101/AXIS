"use client";

import { Check, Download, ExternalLink, ScanLine, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthError } from "@/components/auth/auth-heading";
import { BackupCodes } from "@/components/auth/backup-codes";
import { CodeInput } from "@/components/auth/code-input";
import { PasswordInput } from "@/components/auth/password-input";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { codeErrorKey, passwordErrorKey } from "@/lib/auth-errors";
import { cn } from "@/lib/utils";

const STEPS = ["app", "password", "scan", "verify", "backup"] as const;

// Official store pages of Microsoft Authenticator. aka.ms/authapp is Microsoft's own link
// that sends each phone to the right store, used for the "scan with your phone" QR.
const AUTHENTICATOR_LINKS = {
  ios: "https://apps.apple.com/app/microsoft-authenticator/id983156458",
  android: "https://play.google.com/store/apps/details?id=com.azure.authenticator",
  any: "https://aka.ms/authapp",
} as const;
const HOW_TO = ["download", "open", "add", "scan", "code"] as const;
type Step = (typeof STEPS)[number];
type SetupError = "wrongPassword" | "tooManyAttempts" | "invalidCode" | "alreadyEnabled" | "unknown" | "network";

interface Enrollment {
  totpURI: string;
  secret: string;
  backupCodes: string[];
}

function Stepper({ step }: { step: Step }) {
  const t = useTranslations("auth.setup2fa.steps");
  const index = STEPS.indexOf(step);
  return (
    <ol className="mb-8 grid grid-cols-5 gap-2" aria-label={t("label")}>
      {STEPS.map((name, i) => (
        <li key={name} className="space-y-2" aria-current={i === index ? "step" : undefined}>
          <span
            className={cn(
              "block h-1.5 rounded-full transition-colors duration-300",
              i < index ? "bg-primary" : i === index ? "bg-primary/60" : "bg-muted",
            )}
          />
          <span className={cn("block text-[0.7rem] sm:text-xs", i === index ? "font-medium text-foreground" : "text-muted-foreground")}>
            {t(name)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Groups a base32 secret in blocks of four for easier manual typing. */
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/** Step 0: get Microsoft Authenticator on the phone, with the steps to link it. */
function InstallAuthenticator({ onNext }: { onNext: () => void }) {
  const t = useTranslations("auth.setup2fa.app");
  const [downloadQr, setDownloadQr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(AUTHENTICATOR_LINKS.any, { margin: 1, width: 160, errorCorrectionLevel: "M" })
      .then((url) => {
        if (active) setDownloadQr(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline" className="h-11 justify-start">
          <a href={AUTHENTICATOR_LINKS.ios} target="_blank" rel="noopener noreferrer">
            <Smartphone data-icon="inline-start" aria-hidden />
            <span className="flex-1 text-start">{t("ios")}</span>
            <ExternalLink className="size-3.5 opacity-60" aria-hidden />
          </a>
        </Button>
        <Button asChild variant="outline" className="h-11 justify-start">
          <a href={AUTHENTICATOR_LINKS.android} target="_blank" rel="noopener noreferrer">
            <Smartphone data-icon="inline-start" aria-hidden />
            <span className="flex-1 text-start">{t("android")}</span>
            <ExternalLink className="size-3.5 opacity-60" aria-hidden />
          </a>
        </Button>
      </div>

      {/* On a computer: scan with the phone camera to open the right store. */}
      <div className="hidden items-center gap-4 rounded-xl border bg-muted/40 p-3 sm:flex">
        <div className="shrink-0 rounded-lg border bg-white p-1.5">
          {downloadQr ? (
            // A data: URL generated in the browser; next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={downloadQr} alt={t("qrAlt")} width={96} height={96} className="size-24" />
          ) : (
            <div className="flex size-24 items-center justify-center">
              <Spinner aria-hidden />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("qrTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("qrDescription")}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{t("howTitle")}</p>
        <ol className="space-y-2.5">
          {HOW_TO.map((key, i) => (
            <li key={key} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="pt-0.5 text-muted-foreground">{t(`how.${key}`)}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-muted-foreground">{t("otherApps")}</p>

      <Button size="lg" className="h-10 w-full" onClick={onNext}>
        <Download data-icon="inline-start" aria-hidden />
        {t("next")}
      </Button>
    </div>
  );
}

/**
 * Authenticator enrollment: install the app → confirm password → scan QR (or type the key) → verify the
 * first code → save the backup codes (shown once). Restarting replaces an unfinished
 * enrollment with a fresh secret.
 */
export function SetupTwoFactor({ email, doneHref }: { email: string; doneHref: string }) {
  const t = useTranslations("auth.setup2fa");
  const router = useRouter();
  const passwordId = useId();
  const codeId = useId();
  const savedId = useId();
  const [step, setStep] = useState<Step>("app");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<SetupError | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!enrollment) return;
    let active = true;
    QRCode.toDataURL(enrollment.totpURI, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setQr(null);
      });
    return () => {
      active = false;
    };
  }, [enrollment]);

  const start = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { data, error: enableError } = await authClient.twoFactor.enable({ password });
      if (enableError || !data || !("totpURI" in data)) {
        if (enableError?.code === "TOTP_ALREADY_ENABLED") setError("alreadyEnabled");
        else {
          const key = passwordErrorKey(enableError);
          setError(key === "wrongPassword" || key === "tooManyAttempts" ? key : "unknown");
        }
        return;
      }
      const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
      setEnrollment({ totpURI: data.totpURI, secret, backupCodes: data.backupCodes });
      setPassword("");
      setStep("scan");
    } catch {
      setError("network");
    } finally {
      setPending(false);
    }
  };

  const verify = async (value: string) => {
    if (pending || value.length !== 6) return;
    setError(null);
    setPending(true);
    try {
      const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code: value });
      if (verifyError) {
        const key = codeErrorKey(verifyError);
        setError(key === "tooManyAttempts" ? "tooManyAttempts" : key === "invalidCode" ? "invalidCode" : "unknown");
        setCode("");
        return;
      }
      toast.success(t("success"));
      setStep("backup");
    } catch {
      setError("network");
    } finally {
      setPending(false);
    }
  };

  const message = error && t(`errors.${error}`);

  return (
    <div>
      <Stepper step={step} />

      {step === "app" && <InstallAuthenticator onNext={() => setStep("password")} />}

      {step === "password" && (
        <form onSubmit={start} className="space-y-5">
          <div className="space-y-1">
            <h2 className="font-semibold">{t("password.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("password.description")}</p>
          </div>
          <AuthError>{message}</AuthError>
          <div className="space-y-2">
            <Label htmlFor={passwordId}>{t("password.label")}</Label>
            <PasswordInput
              id={passwordId}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              aria-invalid={error === "wrongPassword" || undefined}
            />
          </div>
          <Button type="submit" size="lg" className="h-10 w-full" disabled={pending || !password}>
            {pending && <Spinner data-icon="inline-start" aria-hidden />}
            {t("password.submit")}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("app")} disabled={pending}>
            {t("password.back")}
          </Button>
        </form>
      )}

      {step === "scan" && enrollment && (
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="font-semibold">{t("scan.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("scan.description")}</p>
          </div>
          <div className="flex justify-center">
            <div className="rounded-2xl border bg-white p-3 shadow-sm">
              {qr ? (
                // A data: URL generated in the browser; next/image adds nothing here.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={t("scan.qrAlt")} width={200} height={200} className="size-48 sm:size-52" />
              ) : (
                <div className="flex size-48 items-center justify-center sm:size-52">
                  <Spinner aria-hidden />
                </div>
              )}
            </div>
          </div>
          {/* Setting up on the phone itself: the otpauth link opens the authenticator app. */}
          <Button asChild variant="secondary" className="w-full sm:hidden">
            <a href={enrollment.totpURI}>
              <Smartphone data-icon="inline-start" aria-hidden />
              {t("scan.openInApp")}
            </a>
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t("scan.apps")}</p>
          <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
            <p className="text-xs font-medium">{t("scan.manualTitle")}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 rounded-md bg-card px-2.5 py-2 font-mono text-sm break-all shadow-xs" dir="ltr">
                {groupSecret(enrollment.secret)}
              </code>
              <CopyButton value={enrollment.secret} label={t("scan.copyKey")} variant="outline" size="icon" />
            </div>
          </div>
          <Button size="lg" className="h-10 w-full" onClick={() => setStep("verify")}>
            <ScanLine data-icon="inline-start" aria-hidden />
            {t("scan.next")}
          </Button>
        </div>
      )}

      {step === "verify" && (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void verify(code);
          }}
        >
          <div className="space-y-1">
            <h2 className="font-semibold">{t("verify.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("verify.description")}</p>
          </div>
          <AuthError>{message}</AuthError>
          <div className="space-y-3">
            <Label htmlFor={codeId} className="sr-only">
              {t("verify.codeLabel")}
            </Label>
            <CodeInput
              id={codeId}
              value={code}
              onChange={(value) => {
                setCode(value);
                if (error) setError(null);
              }}
              onComplete={(value) => void verify(value)}
              disabled={pending}
              invalid={error === "invalidCode"}
            />
          </div>
          <Button type="submit" size="lg" className="h-10 w-full" disabled={pending || code.length !== 6}>
            {pending && <Spinner data-icon="inline-start" aria-hidden />}
            {t("verify.submit")}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("scan")} disabled={pending}>
            {t("verify.back")}
          </Button>
        </form>
      )}

      {step === "backup" && enrollment && (
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-semibold">
              <span className="flex size-6 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="size-3.5" aria-hidden />
              </span>
              {t("backup.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("backup.description")}</p>
          </div>
          <BackupCodes codes={enrollment.backupCodes} email={email} />
          <div className="flex items-start gap-3">
            <Checkbox id={savedId} checked={saved} onCheckedChange={(value) => setSaved(value === true)} className="mt-0.5" />
            <Label htmlFor={savedId} className="font-normal">
              {t("backup.confirm")}
            </Label>
          </div>
          <Button
            size="lg"
            className="h-10 w-full"
            disabled={!saved}
            onClick={() => {
              router.replace(doneHref);
              router.refresh();
            }}
          >
            {t("backup.finish")}
          </Button>
        </div>
      )}

      {step !== "backup" && doneHref.startsWith("/settings") && (
        <p className="mt-6 text-center text-sm">
          <Link href={doneHref} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {t("cancel")}
          </Link>
        </p>
      )}
    </div>
  );
}
