import { Home } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ErrorView } from "@/components/shell/error-view";
import { Button } from "@/components/ui/button";
import { getSessionContext } from "@/server/auth/session";
import { homePath } from "@/server/policy/roles";

// forbidden() from a signed-in page (e.g. requirePageSchool for the owner) renders here, inside the shell.
export default async function AppForbidden() {
  const t = await getTranslations("shell.errors.forbidden");
  const context = await getSessionContext();
  return (
    <ErrorView
      code="403"
      title={t("title")}
      description={t("description")}
      actions={
        <Button asChild size="lg">
          <Link href={context ? homePath(context.user.role) : "/"}>
            <Home data-icon="inline-start" aria-hidden />
            {t("home")}
          </Link>
        </Button>
      }
    />
  );
}
