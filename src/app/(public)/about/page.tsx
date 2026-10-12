import { ArrowRight, Crosshair, Globe2, ShieldCheck, Sprout, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.about.meta");
  return { title: t("title"), description: t("description") };
}

const PRINCIPLES: { key: "precision" | "growth" | "privacy" | "inclusion"; icon: LucideIcon }[] = [
  { key: "precision", icon: Crosshair },
  { key: "growth", icon: Sprout },
  { key: "privacy", icon: ShieldCheck },
  { key: "inclusion", icon: Globe2 },
];

export default async function AboutPage() {
  const t = await getTranslations("landing.about");
  return (
    <>
      <section aria-labelledby="about-title" className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_70%)]"
          aria-hidden
        />
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-20 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-500 sm:px-6 sm:py-28">
          <LogoMark className="mx-auto size-14 shadow-lg shadow-primary/25" />
          <p className="text-sm font-semibold tracking-wide text-primary">{t("eyebrow")}</p>
          <h1 id="about-title" className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="text-lg text-pretty text-muted-foreground">{t("intro")}</p>
        </div>
      </section>

      <section aria-labelledby="about-approach" className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <svg viewBox="0 0 200 160" className="mx-auto w-full max-w-xs" aria-hidden>
            <path d="M30 12 V140 H190" fill="none" className="stroke-muted-foreground/40" strokeWidth="2" strokeLinecap="round" />
            {[40, 70, 100].map((y) => (
              <line key={y} x1="30" x2="190" y1={y} y2={y} className="stroke-border" strokeDasharray="4 6" />
            ))}
            <path
              d="M30 130 C 70 124, 84 96, 112 86 S 156 54, 176 30"
              fill="none"
              className="stroke-primary"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="112" cy="86" r="5" className="fill-card stroke-primary" strokeWidth="2.5" />
            <circle cx="176" cy="30" r="16" className="fill-highlight/20" />
            <circle cx="176" cy="30" r="7.5" className="fill-highlight stroke-card" strokeWidth="3" />
          </svg>
          <div className="space-y-3">
            <h2 id="about-approach" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("approach.title")}
            </h2>
            <p className="text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">{t("approach.body")}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="about-principles" className="border-y bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl space-y-10 px-4 sm:px-6">
          <h2 id="about-principles" className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("principles.title")}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-4 rounded-2xl border bg-card p-6 shadow-xs">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="space-y-1">
                  <h3 className="font-semibold">{t(`principles.items.${key}.title`)}</h3>
                  <p className="text-sm text-pretty text-muted-foreground">{t(`principles.items.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="about-cta" className="py-16 sm:py-20">
        <div className="mx-auto max-w-2xl space-y-5 px-4 text-center sm:px-6">
          <h2 id="about-cta" className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {t("cta.title")}
          </h2>
          <p className="text-muted-foreground">{t("cta.description")}</p>
          <Button asChild size="lg" className="h-11 px-6 text-base">
            <Link href="/login">
              {t("cta.button")}
              <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
