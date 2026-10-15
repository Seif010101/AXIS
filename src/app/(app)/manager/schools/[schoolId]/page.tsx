import { BookOpen, GraduationCap, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { ClassesCard } from "@/components/schools/classes-card";
import { DeleteSchoolDialog } from "@/components/schools/school-dialogs";
import { SchoolFormDialog } from "@/components/schools/school-form-dialog";
import { Button } from "@/components/ui/button";
import { requirePageSession } from "@/server/auth/page";
import { AppError } from "@/server/errors";
import { listClasses } from "@/server/modules/schools/classes";
import { getSchool } from "@/server/modules/schools/schools";

const loadSchool = cache(async (schoolId: string) => {
  const ctx = await requirePageSession("manager");
  try {
    return { ctx, school: await getSchool(ctx, schoolId) };
  } catch (error) {
    if (error instanceof AppError && (error.code === "NOT_FOUND" || error.code === "VALIDATION")) notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps<"/manager/schools/[schoolId]">): Promise<Metadata> {
  const { school } = await loadSchool((await params).schoolId);
  return { title: school.name };
}

export default async function SchoolPage({ params }: PageProps<"/manager/schools/[schoolId]">) {
  const { ctx, school } = await loadSchool((await params).schoolId);
  const groups = await listClasses(ctx, school.id);
  const t = await getTranslations("schools.detail");

  return (
    <>
      <PageHeader
        back={{ href: "/manager/schools", label: t("back") }}
        title={school.branch ? `${school.name} — ${school.branch}` : school.name}
        description={school.ministryCode ? t("code", { code: school.ministryCode }) : t("noCode")}
        actions={
          <>
            <SchoolFormDialog
              school={{ id: school.id, name: school.name, branch: school.branch ?? "", ministryCode: school.ministryCode ?? "" }}
            />
            <DeleteSchoolDialog schoolId={school.id} schoolName={school.name} />
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 pb-6 lg:grid-cols-4">
        <StatCard label={t("stats.students")} value={school.students} icon={GraduationCap} tone="primary" />
        <StatCard label={t("stats.teachers")} value={school.teachers} icon={Users} tone="info" />
        <StatCard label={t("stats.admins")} value={school.admins} icon={ShieldCheck} tone="highlight" />
        <StatCard label={t("stats.classes")} value={school.classes} icon={BookOpen} tone="success" />
      </div>
      <div className="flex flex-wrap gap-2 pb-6">
        <Button asChild>
          <Link href={`/manager/schools/${school.id}/accounts`}>
            <Users aria-hidden />
            {t("manageAccounts")}
          </Link>
        </Button>
      </div>
      <ClassesCard groups={groups} schoolId={school.id} />
    </>
  );
}
