import { getTranslations } from "next-intl/server";

// Temporary placeholder until the redesigned landing page (Phase 2 / 4).
export default async function Home() {
  const t = await getTranslations();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-4xl font-bold">{t("app_name")}</h1>
      <p className="text-lg opacity-70">{t("tagline")}</p>
    </main>
  );
}
