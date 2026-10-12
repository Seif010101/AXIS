import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { getSessionContext } from "@/server/auth/session";
import { homePath } from "@/server/policy/roles";
import { TwoFactorForm } from "./two-factor-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.twoFactor");
  return { title: t("metaTitle") };
}

// Reached from /login when the account has two-step verification. Better Auth keeps the
// half-finished sign-in in a short-lived cookie; without it the form explains and links back.
export default async function TwoFactorPage() {
  const context = await getSessionContext();
  if (context) redirect(homePath(context.user.role));

  const t = await getTranslations("auth.twoFactor");
  return (
    <>
      <AuthHeading icon={ShieldCheck} title={t("title")} subtitle={t("subtitle")} />
      <TwoFactorForm />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("backToLogin")}
        </Link>
      </p>
    </>
  );
}
