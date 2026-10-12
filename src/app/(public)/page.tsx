import {
  ArrowRight,
  BarChart3,
  Bot,
  ClipboardCheck,
  Gamepad2,
  GraduationCap,
  KeyRound,
  Languages,
  LineChart,
  NotebookPen,
  School,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { directionOf, localeNames, locales } from "@/i18n/config";
import type { AppMessages } from "@/i18n/types";
import { cn } from "@/lib/utils";
import { HeroVisual } from "./_components/hero-visual";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.meta");
  const title = `${brand.name} · ${t("title")}`;
  return {
    title: { absolute: title },
    description: t("description"),
    openGraph: { title, description: t("description"), type: "website", siteName: brand.name },
  };
}

type Audience = "students" | "teachers" | "schools";
type Feature = keyof AppMessages["landing"]["audiences"]["features"];

const AUDIENCES: {
  key: Audience;
  icon: LucideIcon;
  accent: string;
  features: { key: Feature; icon: LucideIcon }[];
}[] = [
  {
    key: "students",
    icon: GraduationCap,
    accent: "from-chart-1 to-chart-3",
    features: [
      { key: "tutor", icon: Bot },
      { key: "games", icon: Gamepad2 },
      { key: "challenges", icon: Trophy },
    ],
  },
  {
    key: "teachers",
    icon: NotebookPen,
    accent: "from-chart-2 to-chart-1",
    features: [
      { key: "studio", icon: WandSparkles },
      { key: "homework", icon: ClipboardCheck },
      { key: "tests", icon: BarChart3 },
    ],
  },
  {
    key: "schools",
    icon: School,
    accent: "from-chart-3 to-chart-5",
    features: [
      { key: "management", icon: Users },
      { key: "insights", icon: LineChart },
      { key: "security", icon: ShieldCheck },
    ],
  },
];

const STEPS = [
  { key: "accounts", icon: UserPlus },
  { key: "signIn", icon: KeyRound },
  { key: "learn", icon: Sparkles },
  { key: "insights", icon: LineChart },
] as const;

const FAQ = ["accounts", "password", "security", "ai", "devices", "languages"] as const;

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold tracking-wide text-primary">{children}</p>;
}

function SectionHeading({ eyebrow, title, description, id }: { eyebrow: string; title: string; description?: string; id: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {description && <p className="text-base text-pretty text-muted-foreground sm:text-lg">{description}</p>}
    </div>
  );
}

export default async function LandingPage() {
  const t = await getTranslations("landing");

  return (
    <>
      {/* Hero */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
          aria-hidden
        />
        <div className="absolute inset-x-0 -top-40 -z-10 mx-auto h-96 w-[48rem] max-w-full rounded-full bg-primary/15 blur-3xl" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pt-14 pb-24 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:pt-24 lg:pb-32">
          <div className="space-y-7 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-500 lg:text-start">
            <p className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur sm:text-sm">
              <span className="size-1.5 rounded-full bg-highlight" aria-hidden />
              {t("hero.eyebrow")}
            </p>
            <h1
              id="hero-title"
              className="text-4xl leading-[1.15] font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]"
            >
              {t.rich("hero.title", {
                highlight: (chunks) => <span className="text-brand-gradient">{chunks}</span>,
              })}
            </h1>
            <p className="mx-auto max-w-xl text-lg text-pretty text-muted-foreground lg:mx-0">{t("hero.subtitle")}</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Button asChild size="lg" className="h-11 px-6 text-base shadow-md shadow-primary/20">
                <Link href="/login">
                  {t("hero.primary")}
                  <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-6 text-base">
                <Link href="#how">{t("hero.secondary")}</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t("hero.note")}</p>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Audiences */}
      <section id="features" aria-labelledby="features-title" className="scroll-mt-20 border-t bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-14 px-4 sm:px-6">
          <SectionHeading
            id="features-title"
            eyebrow={t("audiences.eyebrow")}
            title={t("audiences.title")}
            description={t("audiences.description")}
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {AUDIENCES.map(({ key, icon: Icon, accent, features }) => (
              <article
                key={key}
                aria-labelledby={`audience-${key}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-shadow hover:shadow-lg"
              >
                <div className={cn("relative h-28 overflow-hidden bg-linear-135", accent)} aria-hidden>
                  <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                  <span className="absolute -end-6 -bottom-8 size-32 rounded-full border-[14px] border-white/15" />
                  <span className="absolute start-6 bottom-0 flex size-14 translate-y-1/2 items-center justify-center rounded-2xl bg-card text-foreground shadow-md ring-1 ring-border">
                    <Icon className="size-6 text-primary" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-6 px-6 pt-12 pb-7">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t(`audiences.${key}.label`)}
                    </p>
                    <h3 id={`audience-${key}`} className="text-xl font-semibold tracking-tight">
                      {t(`audiences.${key}.title`)}
                    </h3>
                    <p className="text-sm text-pretty text-muted-foreground">{t(`audiences.${key}.description`)}</p>
                  </div>
                  <ul className="mt-auto space-y-4">
                    {features.map(({ key: feature, icon: FeatureIcon }) => (
                      <li key={feature} className="flex gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FeatureIcon className="size-4.5" aria-hidden />
                        </span>
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold">
                            {t(`audiences.features.${feature}.title`)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t(`audiences.features.${feature}.description`)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" aria-labelledby="how-title" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-14 px-4 sm:px-6">
          <SectionHeading id="how-title" eyebrow={t("how.eyebrow")} title={t("how.title")} />
          <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <span
              className="absolute inset-x-[12%] top-7 hidden h-px bg-linear-to-r from-transparent via-border to-transparent lg:block"
              aria-hidden
            />
            {STEPS.map(({ key, icon: Icon }, index) => (
              <li key={key} className="relative space-y-4 rounded-2xl border bg-card p-6 shadow-xs lg:border-0 lg:bg-transparent lg:p-2 lg:text-center lg:shadow-none">
                <span className="relative flex size-14 items-center justify-center rounded-2xl bg-card shadow-md ring-1 ring-border lg:mx-auto">
                  <Icon className="size-6 text-primary" aria-hidden />
                  <span className="absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white tabular-nums">
                    {index + 1}
                  </span>
                </span>
                <div className="space-y-1.5">
                  <h3 className="font-semibold">{t(`how.steps.${key}.title`)}</h3>
                  <p className="text-sm text-pretty text-muted-foreground">{t(`how.steps.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Languages */}
      <section aria-labelledby="languages-title" className="border-y bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div className="space-y-4 text-center lg:text-start">
            <Eyebrow>{t("languages.eyebrow")}</Eyebrow>
            <h2 id="languages-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t("languages.title")}
            </h2>
            <p className="text-base text-pretty text-muted-foreground sm:text-lg">{t("languages.description")}</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {locales.map((locale) => (
              <li
                key={locale}
                className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-xs transition-transform motion-safe:hover:-translate-y-0.5"
              >
                <Languages className="size-4 shrink-0 text-primary" aria-hidden />
                <span lang={locale} dir={directionOf(locale)} className="text-sm font-medium">
                  {localeNames[locale]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl space-y-12 px-4 sm:px-6">
          <SectionHeading id="faq-title" eyebrow={t("faq.eyebrow")} title={t("faq.title")} />
          <Accordion type="single" collapsible className="rounded-2xl border bg-card px-5 shadow-xs sm:px-6">
            {FAQ.map((key) => (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger className="py-5 text-start text-base font-medium">
                  {t(`faq.items.${key}.question`)}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {t(`faq.items.${key}.answer`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Closing call to action */}
      <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6 sm:pb-28">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand-gradient px-6 py-14 text-center text-white shadow-xl sm:px-12 sm:py-16">
          <div
            className="absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:36px_36px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-xl space-y-5">
            <h2 id="cta-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t("cta.title")}
            </h2>
            <p className="text-base text-white/85 sm:text-lg">{t("cta.description")}</p>
            <Button asChild size="lg" variant="secondary" className="h-11 px-6 text-base">
              <Link href="/login">
                {t("cta.button")}
                <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
