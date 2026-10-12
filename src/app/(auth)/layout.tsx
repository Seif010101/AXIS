import { Bot, GraduationCap, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Logo, LogoMark, Wordmark } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";

const POINTS = [
  { key: "tutor", icon: Bot },
  { key: "teachers", icon: GraduationCap },
  { key: "secure", icon: ShieldCheck },
] as const;

/** Abstract "coordinates" artwork for the brand panel: axes, a rising path, data points. */
function PanelArt() {
  return (
    <svg viewBox="0 0 400 260" className="absolute inset-x-0 bottom-0 w-full opacity-90" aria-hidden>
      <defs>
        <linearGradient id="auth-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.28" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M40 20v210M30 220h350" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" />
      <path
        d="M40 210 C 110 200, 130 150, 180 140 S 260 120, 290 80 S 350 40, 380 30 V220 H40Z"
        fill="url(#auth-area)"
      />
      <path
        d="M40 210 C 110 200, 130 150, 180 140 S 260 120, 290 80 S 350 40, 380 30"
        fill="none"
        stroke="white"
        strokeOpacity="0.8"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {[
        [180, 140],
        [290, 80],
      ].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="5" fill="white" fillOpacity="0.9" />
      ))}
      <circle cx="380" cy="30" r="9" fill="var(--highlight)" stroke="white" strokeWidth="3" />
    </svg>
  );
}

// Sign-in and account-setup screens: brand panel on the inline-start side (desktop), form
// on the other side. Phones get the form only.
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("auth.brand");
  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-gradient text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-black/5 dark:bg-black/35" aria-hidden />
        <div
          className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
          aria-hidden
        />
        <PanelArt />
        <div className="relative flex flex-1 flex-col p-10 xl:p-14">
          <Link href="/" className="inline-flex w-fit items-center gap-2.5 rounded-lg focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none">
            <LogoMark className="size-9 rounded-[10px] ring-1 ring-white/30" />
            <Wordmark className="text-lg text-white" />
          </Link>
          <div className="mt-16 max-w-md xl:mt-24">
            <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance xl:text-4xl">{t("title")}</h2>
            <p className="mt-4 text-base text-pretty text-white/80">{t("subtitle")}</p>
            <ul className="mt-10 space-y-5">
              {POINTS.map(({ key, icon: Icon }) => (
                <li key={key} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold">{t(`points.${key}.title`)}</p>
                    <p className="mt-0.5 text-sm text-white/75">{t(`points.${key}.description`)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="relative mt-auto pt-10 text-xs text-white/70">
            {t("rights", { year: new Date().getFullYear() })}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-2 p-4 sm:px-6">
          <Link href="/" className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:invisible">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:items-center sm:px-6 sm:pt-0">
          <div className="w-full max-w-[26rem] animate-in fade-in-0 slide-in-from-bottom-2 duration-300">{children}</div>
        </main>
      </div>
    </div>
  );
}
