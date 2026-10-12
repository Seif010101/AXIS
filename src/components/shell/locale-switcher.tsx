"use client";

import { Check, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { updateLanguageAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { directionOf, isLocale, LOCALE_COOKIE, localeNames, locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Sets the locale cookie in the browser, so the switch also works signed out. */
function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/**
 * Switches the UI language (cookie) and reloads the server-rendered page in place.
 * With `persist`, the choice is also saved to the signed-in user's settings so it follows
 * them to other devices.
 */
export function LocaleSwitcher({
  persist = false,
  showLabel = false,
  className,
}: {
  persist?: boolean;
  showLabel?: boolean;
  className?: string;
}) {
  const t = useTranslations("shell.locale");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: Locale) => {
    if (next === current) return;
    writeLocaleCookie(next);
    startTransition(async () => {
      if (persist) {
        // The cookie is already set; a failed save only means the choice isn't synced.
        await updateLanguageAction({ language: next }).catch(() => undefined);
      }
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? "default" : "icon"}
          className={cn(pending && "opacity-60", className)}
          aria-label={t("label")}
          disabled={pending}
        >
          <Languages aria-hidden />
          {showLabel && isLocale(current) && <span>{localeNames[current]}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((locale) => (
          <DropdownMenuItem key={locale} onSelect={() => change(locale)} className="justify-between gap-6">
            <span lang={locale} dir={directionOf(locale)}>
              {localeNames[locale]}
            </span>
            {locale === current && <Check className="text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
