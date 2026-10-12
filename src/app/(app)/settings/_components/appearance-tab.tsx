"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { SectionCard } from "@/components/common/section-card";
import { THEMES } from "@/components/shell/theme-toggle";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

type ThemeValue = (typeof THEMES)[number]["value"];

// The saved theme is only known in the browser; render no selection on the server.
const subscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/**
 * A tiny drawing of the app in one theme (purely decorative). Each pane sets the `light`
 * or `dark` class, which re-scopes the design tokens to that theme.
 */
function Preview({ value }: { value: ThemeValue }) {
  const pane = (scheme: "light" | "dark") => (
    <div className={cn(scheme, "flex h-full flex-1 gap-1.5 bg-background p-2")}>
      <div className="w-1/4 space-y-1 rounded-sm bg-card p-1 shadow-xs">
        <div className="h-1.5 w-3/4 rounded-full bg-primary" />
        <div className="h-1 w-full rounded-full bg-muted" />
        <div className="h-1 w-2/3 rounded-full bg-muted" />
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="h-2 w-1/2 rounded-full bg-foreground/20" />
        <div className="grid grid-cols-2 gap-1">
          <div className="h-5 rounded-sm bg-card shadow-xs" />
          <div className="h-5 rounded-sm bg-card shadow-xs" />
        </div>
        <div className="h-1.5 w-1/3 rounded-full bg-highlight" />
      </div>
    </div>
  );
  return (
    <div className="flex aspect-[16/10] w-full overflow-hidden rounded-md border" aria-hidden>
      {value === "system" ? (
        <>
          {pane("light")}
          {pane("dark")}
        </>
      ) : (
        pane(value)
      )}
    </div>
  );
}

/** Light / dark / system, per device (next-themes keeps it in the browser). */
export function AppearanceTab() {
  const t = useTranslations("settings.appearance");
  const tTheme = useTranslations("shell.theme");
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const current = hydrated ? (theme ?? "system") : "";

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <RadioGroup
        value={current}
        onValueChange={setTheme}
        aria-label={t("label")}
        className="grid gap-3 sm:grid-cols-3"
      >
        {THEMES.map(({ value, icon: Icon }) => {
          const id = `theme-${value}`;
          const checked = current === value;
          return (
            <label
              key={value}
              htmlFor={id}
              className={cn(
                "relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50 hover:bg-accent/40",
                checked && "border-primary bg-primary/5 hover:bg-primary/5",
              )}
            >
              <Preview value={value} />
              <span className="flex items-start gap-2.5">
                <RadioGroupItem id={id} value={value} className="sr-only" />
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block text-sm font-medium">{tTheme(value)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`options.${value}`)}</span>
                </span>
                {checked && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </SectionCard>
  );
}
