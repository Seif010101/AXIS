import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { getSessionContext } from "@/server/auth/session";
import { homePath, requiresTwoFactor } from "@/server/policy/roles";
import { ChangePasswordScreen } from "./change-password-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.changePassword");
  return { title: t("metaTitle") };
}

// Forced after sign-in while the account still has its temporary password
// (requirePageSession sends users here). Voluntary changes live in Settings → Security.
export default async function ChangePasswordPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  const { user } = context;
  if (!user.mustChangePassword) redirect(homePath(user.role));

  const next = requiresTwoFactor(user.role) && !user.twoFactorEnabled ? "/setup-2fa" : homePath(user.role);
  const t = await getTranslations("auth.changePassword");
  return (
    <>
      <AuthHeading icon={KeyRound} title={t("title")} subtitle={t("subtitle")} />
      <ChangePasswordScreen next={next} />
    </>
  );
}
