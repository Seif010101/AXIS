import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { accountNavigation, navigation, type NavItem, type NavLabel } from "@/config/navigation";

const ITEMS = new Map<NavLabel, Pick<NavItem, "icon">>(
  [...Object.values(navigation).flat(), accountNavigation].flatMap((section) =>
    section.items.map((item) => [item.label, item] as const),
  ),
);
const FALLBACK: Pick<NavItem, "icon"> = { icon: Sparkles };

/**
 * Placeholder for a route whose feature is not built yet. Feature teams replace the page
 * that renders it. `item` is the route's label in src/config/navigation.ts.
 *
 * @example <ComingSoon item="homework" homeHref="/student" />
 */
export function ComingSoon({ item, homeHref }: { item: NavLabel; homeHref?: string }) {
  const t = useTranslations("shell.comingSoon");
  const tNav = useTranslations("nav.items");
  const entry = ITEMS.get(item) ?? FALLBACK;
  const page = tNav(item);
  return (
    <section className="relative isolate flex min-h-[60svh] flex-col items-center justify-center overflow-hidden rounded-2xl border bg-card px-6 py-14 text-center shadow-xs animate-in fade-in-0 zoom-in-[0.98]">
      <div className="absolute inset-0 -z-10 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden />
      <div className="absolute -top-24 start-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl rtl:translate-x-1/2" aria-hidden />
      <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-primary/25">
        <entry.icon className="size-7" aria-hidden />
      </span>
      <Badge variant="secondary" className="mb-3">
        {t("badge")}
      </Badge>
      <h1 className="max-w-lg text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{page}</h1>
      <p className="mt-3 max-w-md text-sm text-pretty text-muted-foreground sm:text-base">{t("description")}</p>
      {homeHref && (
        <Button asChild variant="outline" size="lg" className="mt-7">
          <Link href={homeHref}>
            <ArrowLeft className="rtl:rotate-180" data-icon="inline-start" aria-hidden />
            {t("home")}
          </Link>
        </Button>
      )}
    </section>
  );
}
