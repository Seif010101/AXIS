import { Home } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ErrorView } from "@/components/shell/error-view";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shell.errors.forbidden");
  return { title: t("title") };
}

// Rendered by forbidden() — e.g. requirePageSchool() when the owner opens a school-only page.
export default async function Forbidden() {
  const t = await getTranslations("shell.errors.forbidden");
  return (
    <main className="flex-1">
      <ErrorView
        fullScreen
        code="403"
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild size="lg">
            <Link href="/">
              <Home data-icon="inline-start" aria-hidden />
              {t("home")}
            </Link>
          </Button>
        }
      />
    </main>
  );
}
