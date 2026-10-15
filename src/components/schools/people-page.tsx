import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/common/page-header";
import type { SessionContext } from "@/server/auth/session";
import { listClasses } from "@/server/modules/schools/classes";
import { creatableRoles, listPeople, peopleFiltersSchema, type PeopleScope } from "@/server/modules/schools/people";
import { schoolOptions } from "@/server/modules/schools/schools";
import { flattenClasses } from "./class-options";
import { ListFilters, PaginationBar } from "./list-controls";
import { PeopleList } from "./people-list";

/**
 * The accounts screen used by /manager/schools/[id]/accounts, /admin/people and
 * /owner/users: filters in the URL, one server-rendered page of 50, every action in the list.
 */
export async function PeoplePage({
  ctx,
  scope,
  searchParams,
  title,
  description,
  back,
  exportName,
}: {
  ctx: SessionContext;
  scope: PeopleScope;
  searchParams: Record<string, string | string[] | undefined>;
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label?: string };
  exportName: string;
}) {
  const t = await getTranslations("schools.people");
  const tRoles = await getTranslations("common.roles");
  const filters = peopleFiltersSchema.parse(searchParams);
  const directory = scope.kind === "directory";
  const [{ rows, total, page, pageCount, roleCounts }, groups, schools] = await Promise.all([
    listPeople(ctx, scope, filters),
    directory ? Promise.resolve([]) : listClasses(ctx, scope.schoolId),
    directory ? schoolOptions(ctx) : Promise.resolve([]),
  ]);

  const roles = directory ? (["manager", "admin", "teacher", "student"] as const) : ctx.actor.role === "admin" ? (["teacher", "student"] as const) : (["admin", "teacher", "student"] as const);
  const allowedToCreate = creatableRoles(ctx.actor.role).filter((r) =>
    // The owner directory creates network staff; teachers and students join from their school page.
    directory ? r === "manager" || r === "admin" : (roles as readonly string[]).includes(r),
  );
  const classes = flattenClasses(groups);
  const counts = roles.map((r) => `${tRoles(r)}: ${roleCounts[r] ?? 0}`).join(" · ");

  return (
    <>
      <PageHeader title={title} description={description ?? counts} back={back} />
      <ListFilters
        searchPlaceholder={t("searchPlaceholder")}
        selects={[
          {
            param: "role",
            label: t("filters.role"),
            options: [{ value: "all", label: t("filters.allRoles") }, ...roles.map((r) => ({ value: r, label: tRoles(r) }))],
          },
          {
            param: "status",
            label: t("filters.status"),
            options: [
              { value: "all", label: t("filters.allStatuses") },
              { value: "active", label: t("status.active") },
              { value: "pending", label: t("status.pending") },
              { value: "inactive", label: t("status.inactive") },
            ],
          },
          ...(directory
            ? [
                {
                  param: "school",
                  label: t("filters.school"),
                  options: [
                    { value: "all", label: t("filters.allSchools") },
                    { value: "none", label: t("noSchool") },
                    ...schools.map((s) => ({ value: s.id, label: s.branch ? `${s.name} — ${s.branch}` : s.name })),
                  ],
                },
              ]
            : classes.length > 0
              ? [
                  {
                    param: "grade",
                    label: t("filters.grade"),
                    options: [
                      { value: "all", label: t("filters.allGrades") },
                      ...[...new Set(classes.map((c) => c.grade))].map((g) => ({ value: g, label: g })),
                    ],
                  },
                ]
              : []),
        ]}
      />
      <p className="pb-2 text-sm text-muted-foreground">{t("total", { count: total })}</p>
      <PeopleList
        rows={rows}
        scope={scope}
        creatableRoles={allowedToCreate}
        canDelete={ctx.actor.role === "owner" || ctx.actor.role === "manager"}
        classes={classes}
        schools={schools.map((s) => ({ id: s.id, label: s.branch ? `${s.name} — ${s.branch}` : s.name }))}
        exportName={exportName}
        showSchool={directory}
      />
      <PaginationBar page={page} pageCount={pageCount} />
    </>
  );
}
