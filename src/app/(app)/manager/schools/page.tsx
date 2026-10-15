import { School } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ListFilters, PaginationBar } from "@/components/schools/list-controls";
import { ImportSchoolsDialog } from "@/components/schools/school-dialogs";
import { SchoolFormDialog } from "@/components/schools/school-form-dialog";
import { navMetadata } from "@/components/shell/page-metadata";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageSession } from "@/server/auth/page";
import { listSchools, schoolListSchema } from "@/server/modules/schools/schools";

export const generateMetadata = navMetadata("schools");

export default async function SchoolsPage({ searchParams }: PageProps<"/manager/schools">) {
  const ctx = await requirePageSession("manager");
  const filters = schoolListSchema.parse(await searchParams);
  const { rows, total, page, pageCount } = await listSchools(ctx, filters);
  const t = await getTranslations("schools.list");
  const format = await getFormatter();
  const filtered = Boolean(filters.q) || filters.status !== "all";

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description", { count: total })}
        actions={
          <>
            <ImportSchoolsDialog />
            <SchoolFormDialog />
          </>
        }
      />
      <ListFilters
        searchPlaceholder={t("searchPlaceholder")}
        selects={[
          {
            param: "status",
            label: t("status.label"),
            options: [
              { value: "all", label: t("status.all") },
              { value: "configured", label: t("status.configured") },
              { value: "pending", label: t("status.pending") },
            ],
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={School}
          title={filtered ? t("noResults") : t("empty.title")}
          description={filtered ? undefined : t("empty.description")}
          action={
            filtered ? undefined : (
              <div className="flex flex-wrap justify-center gap-2">
                <SchoolFormDialog />
                <ImportSchoolsDialog />
              </div>
            )
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((school) => (
            <li key={school.id}>
              <Link
                href={`/manager/schools/${school.id}`}
                className="block h-full rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="leading-snug">{school.name}</CardTitle>
                      <Badge variant={school.setupCompleted ? "default" : "secondary"} className="shrink-0">
                        {school.setupCompleted ? t("status.configured") : t("status.pending")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[school.branch, school.ministryCode && t("code", { code: school.ministryCode })]
                        .filter(Boolean)
                        .join(" · ") || t("noBranch")}
                    </p>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <dl className="grid grid-cols-4 gap-2 text-center">
                      {(["students", "teachers", "admins", "classes"] as const).map((key) => (
                        <div key={key} className="flex flex-col-reverse rounded-lg bg-muted/50 px-1 py-2">
                          <dt className="text-xs text-muted-foreground">{t(`counts.${key}`)}</dt>
                          <dd className="text-lg font-semibold tabular-nums">{format.number(school[key])}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-xs text-muted-foreground">
                      {t("created", { date: format.dateTime(school.createdAt, { dateStyle: "medium" }) })}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <PaginationBar page={page} pageCount={pageCount} />
    </>
  );
}
