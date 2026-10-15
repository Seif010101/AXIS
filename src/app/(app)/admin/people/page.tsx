import { getTranslations } from "next-intl/server";
import { ClassesCard } from "@/components/schools/classes-card";
import { PeoplePage } from "@/components/schools/people-page";
import { navMetadata } from "@/components/shell/page-metadata";
import { requirePageSchool, requirePageSession } from "@/server/auth/page";
import { listClasses } from "@/server/modules/schools/classes";
import { getSchool } from "@/server/modules/schools/schools";

export const generateMetadata = navMetadata("people");

export default async function AdminPeoplePage({ searchParams }: PageProps<"/admin/people">) {
  const ctx = await requirePageSession("admin");
  const schoolId = requirePageSchool(ctx);
  const [school, groups, t] = await Promise.all([
    getSchool(ctx, schoolId),
    listClasses(ctx),
    getTranslations("schools.people"),
  ]);
  return (
    <div className="grid gap-8">
      <div>
        <PeoplePage
          ctx={ctx}
          scope={{ kind: "school" }}
          searchParams={await searchParams}
          title={t("adminTitle")}
          exportName={school.name}
        />
      </div>
      <ClassesCard groups={groups} />
    </div>
  );
}
