"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

/** After the forced change: privileged roles enroll 2FA next, everyone else goes home. */
export function ChangePasswordScreen({ next }: { next: string }) {
  const t = useTranslations("auth.changePassword");
  const router = useRouter();
  return (
    <ChangePasswordForm
      onChanged={() => {
        toast.success(t("success"));
        router.replace(next);
        router.refresh();
      }}
    />
  );
}
