"use client";

import { Check, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { AuthError } from "@/components/auth/auth-heading";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordErrorKey,
  passwordStrength,
  type PasswordErrorKey,
} from "@/lib/auth-errors";
import { cn } from "@/lib/utils";

const STRENGTH_LABELS = ["tooShort", "weak", "fair", "good", "strong"] as const;
const STRENGTH_COLORS = ["bg-muted", "bg-destructive", "bg-warning", "bg-info", "bg-success"] as const;

function Rule({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={cn("flex items-center gap-2 transition-colors", ok ? "text-success" : "text-muted-foreground")}>
      {ok ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3" aria-hidden />}
      <span>{children}</span>
    </li>
  );
}

/**
 * Change-password form (current, new, confirm) with live guidance. Used by the forced
 * /change-password screen and by Settings → Security. Calls `onChanged` after success.
 */
export function ChangePasswordForm({
  onChanged,
  submitLabel,
  defaultRevokeOthers = true,
}: {
  onChanged: () => void;
  submitLabel?: string;
  defaultRevokeOthers?: boolean;
}) {
  const t = useTranslations("auth.changePassword");
  const ids = { current: useId(), next: useId(), confirm: useId(), revoke: useId() };
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(defaultRevokeOthers);
  const [error, setError] = useState<PasswordErrorKey | "mismatch" | "network" | null>(null);
  const [pending, setPending] = useState(false);

  const lengthOk = next.length >= PASSWORD_MIN_LENGTH && next.length <= PASSWORD_MAX_LENGTH;
  const differentOk = next.length > 0 && next !== current;
  const matchOk = next.length > 0 && next === confirm;
  const strength = passwordStrength(next);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lengthOk) return setError(next.length > PASSWORD_MAX_LENGTH ? "tooLong" : "tooShort");
    if (!differentOk) return setError("samePassword");
    if (!matchOk) return setError("mismatch");
    setError(null);
    setPending(true);
    try {
      const { error: changeError } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: revokeOthers,
      });
      if (changeError) {
        setError(passwordErrorKey(changeError));
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      onChanged();
    } catch {
      setError("network");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <AuthError>{error && t(`errors.${error}`)}</AuthError>
      <div className="space-y-2">
        <Label htmlFor={ids.current}>{t("current")}</Label>
        <PasswordInput
          id={ids.current}
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          autoComplete="current-password"
          required
          aria-invalid={error === "wrongPassword" || undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.next}>{t("new")}</Label>
        <PasswordInput
          id={ids.next}
          value={next}
          onChange={(event) => setNext(event.target.value)}
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          aria-describedby={`${ids.next}-rules`}
          aria-invalid={error === "tooShort" || error === "tooLong" || error === "samePassword" || undefined}
        />
        <div className="space-y-1.5 pt-1" aria-live="polite">
          <div className="flex gap-1" aria-hidden>
            {[1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className={cn(
                  "h-1.5 flex-1 rounded-full bg-muted transition-colors",
                  strength >= level && STRENGTH_COLORS[strength],
                )}
              />
            ))}
          </div>
          {next.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("strength.label")} <span className="font-medium text-foreground">{t(`strength.${STRENGTH_LABELS[strength]}`)}</span>
            </p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.confirm}>{t("confirm")}</Label>
        <PasswordInput
          id={ids.confirm}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          required
          aria-invalid={error === "mismatch" || undefined}
        />
      </div>
      <ul id={`${ids.next}-rules`} className="space-y-1.5 rounded-lg border bg-muted/40 p-3 text-xs">
        <Rule ok={lengthOk}>{t("rules.length", { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })}</Rule>
        <Rule ok={differentOk}>{t("rules.different")}</Rule>
        <Rule ok={matchOk}>{t("rules.match")}</Rule>
      </ul>
      <div className="flex items-start gap-3">
        <Checkbox
          id={ids.revoke}
          checked={revokeOthers}
          onCheckedChange={(value) => setRevokeOthers(value === true)}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <Label htmlFor={ids.revoke} className="font-normal">
            {t("revokeOthers")}
          </Label>
          <p className="text-xs text-muted-foreground">{t("revokeOthersHint")}</p>
        </div>
      </div>
      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        {pending && <Spinner data-icon="inline-start" aria-hidden />}
        {submitLabel ?? t("submit")}
      </Button>
    </form>
  );
}
