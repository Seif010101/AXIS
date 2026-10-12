"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SectionCard } from "@/components/common/section-card";

/** Settings → Security → Password. Same form and rules as the forced password change. */
export function PasswordCard() {
  const t = useTranslations("settings.security.password");
  const router = useRouter();
  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="max-w-md">
        <ChangePasswordForm
          submitLabel={t("submit")}
          onChanged={() => {
            toast.success(t("changed"));
            // Other devices may have been signed out: refresh the sessions list.
            router.refresh();
          }}
        />
      </div>
    </SectionCard>
  );
}
