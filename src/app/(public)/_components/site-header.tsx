import { ArrowRight, LayoutDashboard, LogIn } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";

const LINKS = [
  { key: "features", href: "/#features" },
  { key: "how", href: "/#how" },
  { key: "faq", href: "/#faq" },
  { key: "about", href: "/about" },
] as const;

/**
 * Sticky header of the public pages. `homeHref` is set when a session exists, so the
 * call to action becomes "Go to dashboard".
 */
export async function SiteHeader({ homeHref }: { homeHref: string | null }) {
  const t = await getTranslations("landing.header");
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/75 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          aria-label={t("home")}
          className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Logo markClassName="size-8" />
        </Link>
        <nav aria-label={t("nav")} className="ms-6 hidden items-center gap-1 md:flex">
          {LINKS.map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t(key)}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <Button asChild className="ms-1 hidden sm:inline-flex">
            <Link href={homeHref ?? "/login"}>
              {homeHref ? <LayoutDashboard data-icon="inline-start" aria-hidden /> : null}
              {homeHref ? t("dashboard") : t("signIn")}
              {!homeHref && <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />}
            </Link>
          </Button>
          <Button asChild size="icon" className="ms-1 sm:hidden" aria-label={homeHref ? t("dashboard") : t("signIn")}>
            <Link href={homeHref ?? "/login"}>
              {homeHref ? <LayoutDashboard aria-hidden /> : <LogIn className="rtl:rotate-180" aria-hidden />}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
