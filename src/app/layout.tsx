import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/shell/providers";
import { brand } from "@/config/brand";
import { directionOf } from "@/i18n/config";
import { cn } from "@/lib/utils";
import "./globals.css";

// One typeface for every locale: Arabic + Latin glyphs. Chinese falls back to the system
// CJK fonts listed in globals.css (--font-sans).
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.app");
  return {
    title: { default: `${brand.name} · ${t("tagline")}`, template: `%s · ${brand.name}` },
    description: t("tagline"),
    applicationName: brand.name,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1424" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dir = directionOf(locale);
  return (
    <html lang={locale} dir={dir} className={cn("h-full antialiased", plex.variable)} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <AppProviders dir={dir}>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
