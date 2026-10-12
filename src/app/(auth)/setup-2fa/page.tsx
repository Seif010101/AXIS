import { Info, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { getSessionContext } from "@/server/auth/session";
import { getTwoFactorStatus } from "@/server/modules/settings/settings";
import { homePath } from "@/server/policy/roles";
import { SetupTwoFactor } from "./setup-two-factor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.setup2fa");
  return { title: t("metaTitle") };
}

// Mandatory for owner/manager/admin (requirePageSession sends them here); optional for
// teachers and students, who reach it from Settings → Security.
export default async function SetupTwoFactorPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  const { user } = context;
  if (user.mustChangePassword) redirect("/change-password");
  if (user.twoFactorEnabled) redirect(homePath(user.role));

  const status = await getTwoFactorStatus(context);
  const t = await getTranslations("auth.setup2fa");
  return (
    <>
      <AuthHeading
        icon={ShieldCheck}
        title={t("title")}
        subtitle={status.required ? t("subtitleRequired") : t("subtitleOptional")}
      />
      {status.pending && (
        <p className="-mt-4 mb-6 flex gap-2 rounded-lg border border-info/30 bg-info/8 px-3 py-2.5 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <span>{t("pending")}</span>
        </p>
      )}
      <SetupTwoFactor
        email={user.email}
        doneHref={status.required ? homePath(user.role) : "/settings?tab=security"}
      />
    </>
  );
}
