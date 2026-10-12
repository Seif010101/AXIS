"use client";

import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { AuthError } from "@/components/auth/auth-heading";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient, registerAuthNavigation } from "@/lib/auth-client";
import { signInErrorKey, type SignInErrorKey } from "@/lib/auth-errors";
import { completeSignInAction } from "../actions";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const [error, setError] = useState<SignInErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  // Better Auth's two-factor redirect navigates with this router.
  useEffect(() => registerAuthNavigation(router.push), [router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setError(null);
    setPending(true);
    try {
      const { data, error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInErrorKey(signInError));
        setPending(false);
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
      <Button type="submit" size="lg" className="h-10 w-full text-sm" disabled={pending}>
        {pending && <Spinner data-icon="inline-start" aria-hidden />}
        {t("submit")}
      </Button>
      <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t("forgot")}</span>
      </p>
    </form>
  );
}
