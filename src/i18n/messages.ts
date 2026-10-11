import { brand } from "@/config/brand";
import type { Locale } from "./config";
import { namespaces, type Namespace } from "./namespaces";

export interface MessageTree {
  [key: string]: string | MessageTree;
}

async function loadNamespace(locale: Locale, namespace: Namespace): Promise<MessageTree> {
  const loaded = (await import(`../../messages/${locale}/${namespace}.json`)) as { default: MessageTree };
  return loaded.default;
}

// Resolves the {brand} token before next-intl parses the ICU messages,
// so callers never have to pass the product name as a value.
export function withBrand<T extends MessageTree>(messages: T, brandName: string = brand.name): T {
  return Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [
      key,
      typeof value === "string" ? value.replaceAll("{brand}", brandName) : withBrand(value, brandName),
    ]),
  ) as T;
}

export async function loadMessages(locale: Locale): Promise<Record<Namespace, MessageTree>> {
  const entries = await Promise.all(
    namespaces.map(async (namespace) => [namespace, await loadNamespace(locale, namespace)] as const),
  );
  return withBrand(Object.fromEntries(entries) as Record<Namespace, MessageTree>);
}
