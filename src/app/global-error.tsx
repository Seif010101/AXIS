"use client";

import { useEffect, useSyncExternalStore } from "react";
import ar from "../../messages/ar/shell.json";
import de from "../../messages/de/shell.json";
import en from "../../messages/en/shell.json";
import es from "../../messages/es/shell.json";
import fr from "../../messages/fr/shell.json";
import zh from "../../messages/zh/shell.json";
import { defaultLocale, directionOf, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import "./globals.css";

// Replaces the root layout when it fails, so no providers (intl, theme) are available:
// the strings come straight from the shell message files and the theme from storage.
const MESSAGES: Record<Locale, typeof ar.errors.global> = {
  ar: ar.errors.global,
  en: en.errors.global,
  zh: zh.errors.global,
  de: de.errors.global,
  es: es.errors.global,
  fr: fr.errors.global,
};

function readLocale(): Locale {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return isLocale(value) ? value : defaultLocale;
}

function prefersDark(): boolean {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("theme");
  } catch {
    // Storage can be blocked; fall back to the OS preference.
  }
  return stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

// Browser-only state, read after hydration (the server render falls back to the defaults).
const noSubscription = () => () => {};

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = useSyncExternalStore(noSubscription, readLocale, () => defaultLocale);
  const dark = useSyncExternalStore(noSubscription, prefersDark, () => false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = MESSAGES[locale];
  return (
    <html lang={locale} dir={directionOf(locale)} className={dark ? "dark" : undefined}>
      <body className="flex min-h-svh items-center justify-center bg-background px-6 font-sans text-foreground antialiased">
        <title>{t.title}</title>
        <main className="flex max-w-md flex-col items-center text-center">
          <p className="text-brand-gradient text-7xl font-bold tracking-tight" dir="ltr" aria-hidden>
            500
          </p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t.description}</p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-8 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {t.retry}
          </button>
          {error.digest && (
            <p className="mt-6 text-xs text-muted-foreground" dir="ltr">
              {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
