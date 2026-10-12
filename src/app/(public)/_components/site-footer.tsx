import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/shell/logo";

/** Footer of the public pages: brand, a few links, rights line. */
export async function SiteFooter() {
  const t = await getTranslations("landing.footer");
  const links = [
    { key: "home", href: "/" },
    { key: "about", href: "/about" },
    { key: "signIn", href: "/login" },
  ] as const;
  return (
    <footer className="border-t bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-xs space-y-3">
          <Logo markClassName="size-8" />
          <p className="text-sm text-muted-foreground">{t("tagline")}</p>
        </div>
        <nav aria-label={t("links")}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {links.map(({ key, href }) => (
              <li key={key}>
                <Link
                  href={href}
                  className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          {t("rights", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
