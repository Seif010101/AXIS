import { Bot, Flame, ShieldCheck, Star, Target } from "lucide-react";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/shell/logo";
import { cn } from "@/lib/utils";

const STATS = [
  { key: "stars", icon: Star, tone: "bg-star/20 text-star-foreground dark:text-star", bar: "w-2/3" },
  { key: "streak", icon: Flame, tone: "bg-chart-5/15 text-chart-5", bar: "w-1/2" },
  { key: "goals", icon: Target, tone: "bg-success/15 text-success", bar: "w-3/4" },
] as const;

// A rising line on a pair of axes, ending in the highlighted data point of the logo.
const LINE = "M12 98 C 52 94, 66 74, 98 70 S 150 62, 172 46 S 226 30, 252 20";
const POINTS = [
  [98, 70],
  [172, 46],
] as const;
const BARS = [18, 26, 22, 34, 30, 40, 36] as const;

/** Progress chart drawn with tokens only, so it follows the theme. */
function ProgressChart() {
  const id = useId();
  return (
    <svg viewBox="0 0 264 112" className="h-auto w-full" aria-hidden>
      <defs>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--primary)", stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: "var(--primary)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {[30, 58, 86].map((y) => (
        <line key={y} x1="12" x2="256" y1={y} y2={y} className="stroke-border" strokeDasharray="3 5" />
      ))}
      {BARS.map((height, index) => (
        <rect
          key={index}
          x={22 + index * 34}
          y={106 - height}
          width="12"
          height={height}
          rx="3"
          className="fill-highlight/25"
        />
      ))}
      <path d={`${LINE} V106 H12 Z`} fill={`url(#${id}-area)`} />
      <path d={LINE} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 6 V106 H258" fill="none" className="stroke-muted-foreground/50" strokeWidth="1.5" strokeLinecap="round" />
      {POINTS.map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="3.5" className="fill-card stroke-primary" strokeWidth="2" />
      ))}
      <circle cx="252" cy="20" r="11" className="fill-highlight/20 motion-safe:animate-pulse" />
      <circle cx="252" cy="20" r="5.5" className="fill-highlight stroke-card" strokeWidth="2.5" />
    </svg>
  );
}

/** Abstract product illustration for the hero (CSS + SVG, no images, no made-up figures). */
export function HeroVisual() {
  const t = useTranslations("landing.hero.visual");
  return (
    <div role="img" aria-label={t("label")} className="relative mx-auto w-full max-w-xl select-none">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-brand-gradient opacity-25 blur-3xl dark:opacity-30" aria-hidden />

      <div
        className="relative overflow-hidden rounded-2xl border bg-card shadow-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-700"
        aria-hidden
      >
        <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-chart-5/70" />
          <span className="size-2.5 rounded-full bg-warning/80" />
          <span className="size-2.5 rounded-full bg-success/70" />
          <span className="mx-auto h-4 w-2/5 rounded-full bg-foreground/8" />
        </div>

        <div className="grid grid-cols-[3rem_1fr] sm:grid-cols-[8.5rem_1fr]">
          <div className="space-y-2.5 border-e bg-muted/25 p-2.5 sm:p-3">
            <div className="flex items-center gap-2 pb-1">
              <LogoMark className="size-6" />
              <span className="hidden h-2.5 w-14 rounded-full bg-foreground/15 sm:block" />
            </div>
            {[true, false, false, false, false].map((active, index) => (
              <div
                key={index}
                className={cn(
                  "flex h-7 items-center gap-2 rounded-md px-1.5",
                  active && "bg-primary/10 ring-1 ring-primary/15",
                )}
              >
                <span className={cn("size-3.5 shrink-0 rounded-[5px]", active ? "bg-primary" : "bg-foreground/15")} />
                <span
                  className={cn(
                    "hidden h-2 rounded-full sm:block",
                    active ? "w-14 bg-primary/50" : "bg-foreground/10",
                    !active && (index % 2 ? "w-10" : "w-16"),
                  )}
                />
              </div>
            ))}
          </div>

          <div className="min-w-0 space-y-3 p-3 sm:p-4">
            <div className="space-y-1.5">
              <span className="block h-3 w-1/3 rounded-full bg-foreground/20" />
              <span className="block h-2 w-1/2 rounded-full bg-foreground/10" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {STATS.map(({ key, icon: Icon, tone, bar }) => (
                <div key={key} className="space-y-2 rounded-lg border bg-background/60 p-2 sm:p-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", tone)}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="truncate text-[0.65rem] font-medium text-muted-foreground sm:text-xs">{t(key)}</span>
                  </div>
                  <span className={cn("block h-2 rounded-full bg-foreground/15", bar)} />
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-background/60 p-2.5 sm:p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium">{t("progress")}</span>
                <span className="h-2 w-10 rounded-full bg-foreground/10" />
              </div>
              <ProgressChart />
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute -bottom-8 start-4 w-60 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur animate-in fade-in-0 slide-in-from-bottom-3 delay-300 duration-700 fill-mode-backwards sm:-start-8 sm:w-64"
        aria-hidden
      >
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-gradient text-white">
            <Bot className="size-4" />
          </span>
          <span className="text-xs font-semibold">{t("tutor")}</span>
          <span className="ms-auto flex gap-0.5">
            <span className="size-1 rounded-full bg-primary/60 motion-safe:animate-bounce" />
            <span className="size-1 rounded-full bg-primary/60 motion-safe:animate-bounce [animation-delay:120ms]" />
            <span className="size-1 rounded-full bg-primary/60 motion-safe:animate-bounce [animation-delay:240ms]" />
          </span>
        </div>
        <p className="mt-2 rounded-lg rounded-ss-sm bg-muted px-2.5 py-2 text-xs leading-relaxed">{t("tutorMessage")}</p>
      </div>

      <div
        className="absolute -top-4 end-3 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-md animate-in fade-in-0 slide-in-from-top-2 delay-500 duration-700 fill-mode-backwards sm:-end-5"
        aria-hidden
      >
        <ShieldCheck className="size-3.5 text-success" />
        {t("secure")}
      </div>
    </div>
  );
}
