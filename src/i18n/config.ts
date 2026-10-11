export const locales = ["ar", "en", "zh", "de", "es", "fr"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

// Brand-neutral cookie name so the Phase 6 rename doesn't log anyone out of their language.
export const LOCALE_COOKIE = "locale";

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function directionOf(locale: string): "rtl" | "ltr" {
  return RTL_LANGUAGES.has(locale.split("-")[0]) ? "rtl" : "ltr";
}

export const localeNames: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
  zh: "中文",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
};
