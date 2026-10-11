import { getTranslations } from "next-intl/server";

// Temporary placeholder until the landing page is built.
export default async function Home() {
  const t = await getTranslations("common.app");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-4xl font-bold">{t("name")}</h1>
      <p className="text-lg opacity-70">{t("tagline")}</p>
    </main>
  );
}
