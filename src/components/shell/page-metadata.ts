import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { NavLabel } from "@/config/navigation";

/**
 * `generateMetadata` for a page whose title is its sidebar label.
 *
 * @example export const generateMetadata = navMetadata("homework");
 */
export function navMetadata(label: NavLabel) {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("nav.items");
    return { title: t(label) };
  };
}
