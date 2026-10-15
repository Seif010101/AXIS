import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { PeoplePage } from "@/components/schools/people-page";
import { requirePageSession } from "@/server/auth/page";
import { AppError } from "@/server/errors";
import { getSchool } from "@/server/modules/schools/schools";

const loadSchool = cache(async (schoolId: string) => {
  const ctx = await requirePageSession("manager");
  try {
    return { ctx, school: await getSchool(ctx, schoolId) };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps<"/manager/schools/[schoolId]/accounts">): Promise<Metadata> {
  const { school } = await loadSchool((await params).schoolId);
  const t = await getTranslations("schools.people");
  return { title: t("schoolTitle", { school: school.name }) };
}

export default async function SchoolAccountsPage({ params, searchParams }: PageProps<"/manager/schools/[schoolId]/accounts">) {
  const { ctx, school } = await loadSchool((await params).schoolId);
  const t = await getTranslations("schools.people");
  return (
    <PeoplePage
      ctx={ctx}
      scope={{ kind: "school", schoolId: school.id }}
      searchParams={await searchParams}
      title={t("schoolTitle", { school: school.branch ? `${school.name} — ${school.branch}` : school.name })}
      back={{ href: `/manager/schools/${school.id}`, label: school.name }}
      exportName={school.name}
    />
  );
}
