"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SectionCard } from "@/components/common/section-card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { directionOf, isLocale, localeNames, locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { updateLanguageAction } from "../actions";

/**
 * The UI language, saved to the account (user_settings.language) and the locale cookie;
 * the action refreshes the page so it re-renders in the new language.
 */
export function LanguageTab({ current }: { current: Locale }) {
  const t = useTranslations("settings.language");
  const [selected, setSelected] = useState<Locale>(current);
  const { execute, pending } = useAction(updateLanguageAction);

  const change = async (value: string) => {
    if (!isLocale(value) || value === selected) return;
    const previous = selected;
    setSelected(value);
    const result = await execute({ language: value });
    if (!result.ok) setSelected(previous);
  };

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <RadioGroup
        value={selected}
        onValueChange={(value) => void change(value)}
        aria-label={t("label")}
        aria-busy={pending}
        disabled={pending}
        className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {locales.map((locale) => {
          const id = `language-${locale}`;
          const checked = selected === locale;
          return (
            <label
              key={locale}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-3.5 py-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50 hover:bg-accent/40 has-disabled:cursor-wait",
                checked && "border-primary bg-primary/5 hover:bg-primary/5",
              )}
            >
              <RadioGroupItem id={id} value={locale} className="sr-only" />
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                aria-hidden
              >
                {locale}
              </span>
              <span lang={locale} dir={directionOf(locale)} className="flex-1 text-sm font-medium">
                {localeNames[locale]}
              </span>
              {checked &&
                (pending ? (
                  <Spinner className="size-4 text-primary" aria-hidden />
                ) : (
                  <Check className="size-4 text-primary" aria-hidden />
                ))}
            </label>
          );
        })}
      </RadioGroup>
    </SectionCard>
  );
}
