"use client";

import { Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ErrorView } from "@/components/shell/error-view";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";

// Errors inside a signed-in page keep the shell (sidebar, top bar) usable.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("shell.errors.error");
  const { homeHref } = useShell();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorView
      code="500"
      title={t("title")}
      description={t("description")}
      footer={error.digest ? t("reference", { digest: error.digest }) : undefined}
      actions={
        <>
          <Button size="lg" onClick={() => retry()}>
            <RotateCcw data-icon="inline-start" aria-hidden />
            {t("retry")}
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={homeHref}>
              <Home data-icon="inline-start" aria-hidden />
              {t("home")}
            </Link>
          </Button>
        </>
      }
    />
  );
}
