import { brand } from "@/config/brand";
import type { Locale } from "./config";

type Messages = Record<string, string>;

const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  ar: () => import("../../messages/ar.json"),
  en: () => import("../../messages/en.json"),
  zh: () => import("../../messages/zh.json"),
  de: () => import("../../messages/de.json"),
  es: () => import("../../messages/es.json"),
  fr: () => import("../../messages/fr.json"),
};

// Resolves the {brand} token before next-intl parses the ICU messages,
// so callers never have to pass the product name as a value.
export function withBrand(messages: Messages, brandName: string = brand.name): Messages {
  return Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [key, value.replaceAll("{brand}", brandName)]),
  );
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  const { default: messages } = await loaders[locale]();
  return withBrand(messages);
}
