import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { env } from "@/env";
import { getSessionContext } from "@/server/auth/session";
import { homePath } from "@/server/policy/roles";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

export default async function LoginPage() {
  // Already signed in: go home (the app gate finishes any pending account setup).
  const context = await getSessionContext();
  if (context) redirect(homePath(context.user.role));

  const t = await getTranslations("auth.login");
  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <LoginForm turnstileSiteKey={env.TURNSTILE_SECRET_KEY ? (env.TURNSTILE_SITE_KEY ?? null) : null} />
      <p className="mt-8 text-center text-xs text-muted-foreground">{t("accountsNote")}</p>
    </>
  );
}
