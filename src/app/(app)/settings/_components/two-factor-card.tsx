"use client";

import { KeyRound, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthError } from "@/components/auth/auth-heading";
import { BackupCodes } from "@/components/auth/backup-codes";
import { PasswordInput } from "@/components/auth/password-input";
import { useStepUp } from "@/components/auth/step-up-provider";
import { SectionCard } from "@/components/common/section-card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { isStepUpRequired, passwordErrorKey, type AuthClientError } from "@/lib/auth-errors";
import { cn } from "@/lib/utils";
import type { TwoFactorStatus } from "@/server/modules/settings/settings";

type PromptError = "wrongPassword" | "tooManyAttempts" | "unknown" | "network";

/** null when the user simply dismissed the step-up code dialog. */
function promptError(error: AuthClientError): PromptError | null {
  if (isStepUpRequired(error)) return null;
  const key = passwordErrorKey(error);
  return key === "wrongPassword" || key === "tooManyAttempts" ? key : "unknown";
}

/**
 * A confirmation that needs the account password (Better Auth re-checks it for every
 * authenticator change). `run` returns an error key, or null on success.
 */
function PasswordPrompt({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  run,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  run: (password: string) => Promise<PromptError | null | "dismissed">;
}) {
  const t = useTranslations("settings.security");
  const tActions = useTranslations("common.actions");
  const id = useId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<PromptError | null>(null);
  const [pending, setPending] = useState(false);

  const close = (next: boolean) => {
    if (pending) return;
    if (!next) {
      setPassword("");
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await run(password);
      if (result !== "dismissed") setError(result);
      if (result === null) setPassword("");
    } catch {
      setError("network");
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <form onSubmit={submit} className="contents">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <AuthError>{error && t(`errors.${error}`)}</AuthError>
            <div className="space-y-2">
              <Label htmlFor={id}>{t("passwordLabel")}</Label>
              <PasswordInput
                id={id}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                autoFocus
                aria-invalid={error === "wrongPassword" || undefined}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              {tActions("cancel")}
            </AlertDialogCancel>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending || !password}>
              {pending && <Spinner data-icon="inline-start" aria-hidden />}
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shows freshly generated backup codes once, until the user confirms they saved them. */
function NewBackupCodes({ codes, email, onDone }: { codes: string[]; email: string; onDone: () => void }) {
  const t = useTranslations("settings.security.backupCodes");
  const id = useId();
  const [saved, setSaved] = useState(false);
  return (
    <AlertDialog open>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("readyTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("readyDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <BackupCodes codes={codes} email={email} />
        <div className="flex items-start gap-3">
          <Checkbox id={id} checked={saved} onCheckedChange={(value) => setSaved(value === true)} className="mt-0.5" />
          <Label htmlFor={id} className="font-normal">
            {t("confirmSaved")}
          </Label>
        </div>
        <AlertDialogFooter>
          <Button onClick={onDone} disabled={!saved}>
            {t("done")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const STATE_STYLE = {
  on: { icon: ShieldCheck, badge: "bg-success/12 text-success", tile: "bg-success/12 text-success" },
  off: { icon: ShieldOff, badge: "bg-muted text-muted-foreground", tile: "bg-muted text-muted-foreground" },
  pending: { icon: ShieldAlert, badge: "bg-warning/15 text-warning-foreground dark:text-warning", tile: "bg-warning/15 text-warning-foreground dark:text-warning" },
} as const;

/**
 * Settings → Security → two-step verification and backup codes. Turning it on happens on
 * /setup-2fa; turning it off is offered only to roles that don't require it. Authenticator
 * changes need a fresh code (step-up) once 2FA is on, handled by withStepUp().
 */
export function TwoFactorCard({ status, email }: { status: TwoFactorStatus; email: string }) {
  const t = useTranslations("settings.security");
  const router = useRouter();
  const { withStepUp } = useStepUp();
  const [prompt, setPrompt] = useState<"disable" | "regenerate" | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const state = status.enabled ? "on" : status.pending ? "pending" : "off";
  const { icon: Icon, badge, tile } = STATE_STYLE[state];
  const note = status.enabled
    ? status.required
      ? t("twoFactor.requiredNote")
      : t("twoFactor.onNote")
    : status.pending
      ? t("twoFactor.pendingNote")
      : t("twoFactor.offNote");

  const disable = async (password: string) => {
    const { error } = await withStepUp(() => authClient.twoFactor.disable({ password }));
    if (error) return promptError(error) ?? "dismissed";
    setPrompt(null);
    toast.success(t("twoFactor.disabled"));
    router.refresh();
    return null;
  };

  const regenerate = async (password: string) => {
    const { data, error } = await withStepUp(() => authClient.twoFactor.generateBackupCodes({ password }));
    if (error) return promptError(error) ?? "dismissed";
    if (!data?.backupCodes?.length) return "unknown";
    setPrompt(null);
    setCodes(data.backupCodes);
    return null;
  };

  return (
    <SectionCard
      title={t("twoFactor.title")}
      description={t("twoFactor.description")}
      action={<Badge className={cn("border-0", badge)}>{t(`twoFactor.status.${state}`)}</Badge>}
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tile)} aria-hidden>
            <Icon className="size-5" />
          </span>
          <p className="flex-1 text-sm text-muted-foreground">{note}</p>
          {!status.enabled && (
            <Button asChild className="sm:shrink-0">
              <Link href="/setup-2fa">{status.pending ? t("twoFactor.finish") : t("twoFactor.enable")}</Link>
            </Button>
          )}
          {status.enabled && !status.required && (
            <Button variant="outline" className="sm:shrink-0" onClick={() => setPrompt("disable")}>
              {t("twoFactor.disable")}
            </Button>
          )}
        </div>

        {status.enabled && (
          <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden>
              <KeyRound className="size-5" />
            </span>
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium">{t("backupCodes.title")}</p>
              <p className="text-sm text-muted-foreground">{t("backupCodes.description")}</p>
            </div>
            <Button variant="outline" className="sm:shrink-0" onClick={() => setPrompt("regenerate")}>
              {t("backupCodes.regenerate")}
            </Button>
          </div>
        )}
      </div>

      <PasswordPrompt
        open={prompt === "disable"}
        onOpenChange={(open) => setPrompt(open ? "disable" : null)}
        title={t("twoFactor.disableTitle")}
        description={t("twoFactor.disableDescription")}
        confirmLabel={t("twoFactor.disable")}
        destructive
        run={disable}
      />
      <PasswordPrompt
        open={prompt === "regenerate"}
        onOpenChange={(open) => setPrompt(open ? "regenerate" : null)}
        title={t("backupCodes.regenerateTitle")}
        description={t("backupCodes.regenerateDescription")}
        confirmLabel={t("backupCodes.create")}
        run={regenerate}
      />
      {codes && (
        <NewBackupCodes
          codes={codes}
          email={email}
          onDone={() => {
            setCodes(null);
            toast.success(t("backupCodes.created"));
          }}
        />
      )}
    </SectionCard>
  );
}
