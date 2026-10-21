"use client";

import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AuthError } from "@/components/auth/auth-heading";
import { PasswordInput } from "@/components/auth/password-input";
import { TurnstileWidget, type TurnstileHandle } from "@/components/auth/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient, registerAuthNavigation } from "@/lib/auth-client";
import { signInErrorKey, type SignInErrorKey } from "@/lib/auth-errors";
import { TURNSTILE_HEADER, TURNSTILE_LOGIN_ACTION } from "@/lib/turnstile";
import { completeSignInAction } from "../actions";

/** `turnstileSiteKey` is null when the bot check isn't configured (local development). */
export function LoginForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const [error, setError] = useState<SignInErrorKey | null>(null);
  const [pending, setPending] = useState(false);
  const turnstile = useRef<TurnstileHandle>(null);
  const [botToken, setBotToken] = useState<string | null>(null);
  const onBotToken = useCallback((token: string | null) => setBotToken(token), []);
  const waitingForBotCheck = turnstileSiteKey !== null && !botToken;

  // Better Auth's two-factor redirect navigates with this router.
  useEffect(() => registerAuthNavigation(router.push), [router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (waitingForBotCheck) return;
    setError(null);
    setPending(true);
    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email,
        password,
        fetchOptions: botToken ? { headers: { [TURNSTILE_HEADER]: botToken } } : undefined,
      });
      if (signInError) {
        setError(signInErrorKey(signInError));
        setPending(false);
        // The token was spent on this attempt; get a fresh one for the next.
        turnstile.current?.reset();
        return;
      }
      // Second step required: onTwoFactorRedirect is already taking the user to /two-factor.
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return;

      const result = await completeSignInAction({});
      router.replace(result.ok ? result.data.next : "/");
      router.refresh();
    } catch {
      setError("network");
      setPending(false);
      turnstile.current?.reset();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <AuthError>{error && t(`errors.${error}`)}</AuthError>
      <div className="space-y-2">
        <Label htmlFor={emailId}>{t("email")}</Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="username"
          inputMode="email"
          dir="ltr"
          placeholder={t("emailPlaceholder")}
          className="h-10 text-start"
          aria-invalid={error === "invalidCredentials" || undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={passwordId}>{t("password")}</Label>
        <PasswordInput
          id={passwordId}
          name="password"
          required
          autoComplete="current-password"
          aria-invalid={error === "invalidCredentials" || undefined}
        />
      </div>
      {turnstileSiteKey && (
        <TurnstileWidget
          ref={turnstile}
          siteKey={turnstileSiteKey}
          action={TURNSTILE_LOGIN_ACTION}
          onToken={onBotToken}
        />
      )}
      <Button type="submit" size="lg" className="h-10 w-full text-sm" disabled={pending || waitingForBotCheck}>
        {pending && <Spinner data-icon="inline-start" aria-hidden />}
        {waitingForBotCheck ? t("botCheck.waiting") : t("submit")}
      </Button>
      <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t("forgot")}</span>
      </p>
    </form>
  );
}
