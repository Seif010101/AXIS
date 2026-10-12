"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

/** Signs out through Better Auth, then leaves the signed-in app. */
export function useSignOut() {
  const router = useRouter();
  const t = useTranslations("shell.userMenu");
  const [pending, setPending] = useState(false);
  const signOut = useCallback(async () => {
    setPending(true);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        toast.error(t("signOutFailed"));
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error(t("signOutFailed"));
    } finally {
      setPending(false);
    }
  }, [router, t]);
  return { signOut, pending };
}
