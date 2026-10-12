import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "primary" | "success" | "warning" | "info" | "star" | "highlight" | "destructive" | "neutral";

/** Icon-chip colors per tone; reuse it in other composites that show a tone. */
export const TONE_CHIP: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/18 text-warning-foreground dark:text-warning",
  info: "bg-info/12 text-info",
  star: "bg-star/25 text-star-foreground dark:bg-star/15 dark:text-star",
  highlight: "bg-highlight/18 text-highlight-foreground dark:text-highlight",
  destructive: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

export interface StatDelta {
  /** Already formatted, e.g. "+12%" or "3". */
  value: ReactNode;
  direction: "up" | "down" | "flat";
  /** Whether this change is good news. Defaults to `direction === "up"`. */
  good?: boolean;
  /** Context such as "vs last week". */
  label?: ReactNode;
}

/**
 * A single metric: label, big value, optional change and icon.
 *
 * @example <StatCard label={t("stars")} value={format.number(120)} icon={Star} tone="star"
 *   delta={{ value: "+8", direction: "up", label: t("thisWeek") }} />
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  delta,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  delta?: StatDelta;
  hint?: ReactNode;
  className?: string;
}) {
  const good = delta ? (delta.good ?? delta.direction === "up") : false;
  const DeltaIcon = delta?.direction === "up" ? TrendingUp : delta?.direction === "down" ? TrendingDown : Minus;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs transition-shadow hover:shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE_CHIP[tone])}>
            <Icon className="size-[18px]" aria-hidden />
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p>
      {(delta || hint) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
                delta.direction === "flat"
                  ? "bg-muted text-muted-foreground"
                  : good
                    ? "bg-success/12 text-success"
                    : "bg-destructive/10 text-destructive",
              )}
            >
              <DeltaIcon className="size-3.5" aria-hidden />
              <span dir="ltr">{delta.value}</span>
            </span>
          )}
          {delta?.label && <span>{delta.label}</span>}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}
