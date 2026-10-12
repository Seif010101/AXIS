import { Bell } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Top-bar notifications entry. A slot: for now a link to /notifications; the insights
 * area replaces its body with the live bell (unread badge, popover). Keep the export name.
 */
export function NotificationBell() {
  const t = useTranslations("shell.topbar");
  return (
    <Button asChild variant="ghost" size="icon" aria-label={t("notifications")}>
      <Link href="/notifications">
        <Bell aria-hidden />
      </Link>
    </Button>
  );
}
