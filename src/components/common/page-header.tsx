import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Top of every page: title, optional description, actions on the inline-end side (they
 * wrap below the title on small screens) and an optional back link.
 *
 * @example
 * <PageHeader title={t("title")} description={t("subtitle")} actions={<Button>…</Button>}
 *   back={{ href: "/teacher/homework" }} />
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Back link above the title; the label defaults to common.actions.back. */
  back?: { href: string; label?: string };
  className?: string;
}) {
  const t = useTranslations("common.actions");
  return (
    <header className={cn("flex flex-col gap-4 pb-6 animate-in fade-in-0 slide-in-from-bottom-1", className)}>
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {back.label ?? t("back")}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
          {description && (
            <p className="max-w-2xl text-sm text-pretty text-muted-foreground sm:text-base">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
