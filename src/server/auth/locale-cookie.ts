import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Persists the UI language for this browser. Only callable from server actions and route handlers. */
export async function setLocaleCookie(locale: Locale): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
}
