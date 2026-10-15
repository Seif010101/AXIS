"use client";

import {
  BookOpen,
  Download,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Power,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { exportPeopleAction, reissueCredentialsAction, resetPasswordAction, setActiveAction } from "@/app/(app)/_actions/people";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { RoleBadge } from "@/components/common/role-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import type { PersonRow } from "@/server/modules/schools/people";
import type { ClassOption } from "./class-options";
import { CredentialsSheet, type CredentialRow } from "./credentials-sheet";
import { buildCsv, fileSlug } from "./csv";
import { downloadBlob } from "./list-controls";
import { AssignmentsDialog, DeletePersonDialog, PersonFormDialog } from "./person-dialogs";

type AccountRole = PersonRow["role"];
type Scope = { kind: "school"; schoolId?: string } | { kind: "directory" };

export interface PeopleListProps {
  rows: PersonRow[];
  scope: Scope;
  /** Roles the viewer may create here (empty hides the button). */
  creatableRoles: readonly AccountRole[];
  /** Managers and the owner may delete; school admins deactivate instead. */
  canDelete: boolean;
  classes: ClassOption[];
  schools?: { id: string; label: string }[];
  /** Used in the export file name. */
  exportName: string;
  showSchool?: boolean;
}

/** The accounts table with every administrative action (dialogs, step-up, one-time passwords). */
export function PeopleList({ rows, scope, creatableRoles, canDelete, classes, schools, exportName, showSchool }: PeopleListProps) {
  const t = useTranslations("schools.people");
  const tRoles = useTranslations("common.roles");
  const format = useFormatter();
  const params = useSearchParams();

  const [credentials, setCredentials] = useState<CredentialRow[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PersonRow | undefined>();
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PersonRow | null>(null);
  const [resetting, setResetting] = useState<PersonRow | null>(null);
  const [toggling, setToggling] = useState<PersonRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reset = useAction(resetPasswordAction, { onSuccess: (c) => setCredentials([c]) });
  const toggle = useAction(setActiveAction, { successMessage: t("statusChanged") });
  const reissue = useAction(reissueCredentialsAction, {
    onSuccess: (list) => {
      setSelected(new Set());
      setCredentials(list);
    },
  });
  const exporter = useAction(exportPeopleAction);

  const pendingRows = rows.filter((r) => r.pending && r.isActive);
  const teacher = teacherId ? (rows.find((r) => r.id === teacherId) ?? null) : null;

  const statusBadge = (row: PersonRow) =>
    !row.isActive ? (
      <Badge variant="outline" className="border-destructive/40 text-destructive">
        {t("status.inactive")}
      </Badge>
    ) : row.pending ? (
      <Badge variant="outline" className="border-warning/50 text-warning-foreground dark:text-warning">
        {t("status.pending")}
      </Badge>
    ) : (
      <Badge variant="outline" className="border-success/40 text-success">
        {t("status.active")}
      </Badge>
    );

  const classOf = (row: PersonRow) => {
    if (row.role === "student") return [row.grade, row.section].filter(Boolean).join(" / ") || "—";
    if (row.role === "teacher") {
      return row.assignments.length
        ? row.assignments.map((a) => [a.grade, a.section].filter(Boolean).join("/")).join("، ")
        : t("noClasses");
    }
    return "—";
  };

  const columns: DataTableColumn<PersonRow>[] = [
    ...(pendingRows.length > 0
      ? [
          {
            id: "select",
            header: <span className="sr-only">{t("select")}</span>,
            cell: (row: PersonRow) =>
              row.pending && row.isActive ? (
                <Checkbox
                  aria-label={t("selectRow", { name: row.name })}
                  checked={selected.has(row.id)}
                  onCheckedChange={(checked) =>
                    setSelected((s) => {
                      const next = new Set(s);
                      if (checked) next.add(row.id);
                      else next.delete(row.id);
                      return next;
                    })
                  }
                />
              ) : null,
            hideOnMobile: true,
          } satisfies DataTableColumn<PersonRow>,
        ]
      : []),
    {
      id: "name",
      header: t("columns.name"),
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <div className="font-medium">{row.name}</div>
          <div className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
            {row.email}
          </div>
        </div>
      ),
    },
    { id: "role", header: t("columns.role"), cell: (row) => <RoleBadge role={row.role} /> },
    ...(showSchool
      ? [
          {
            id: "school",
            header: t("columns.school"),
            cell: (row: PersonRow) =>
              row.schoolName ? [row.schoolName, row.schoolBranch].filter(Boolean).join(" — ") : t("noSchool"),
          },
        ]
      : []),
    { id: "class", header: t("columns.class"), cell: classOf },
    {
      id: "progress",
      header: t("columns.stars"),
      cell: (row) =>
        row.role === "student" ? (
          <span className="tabular-nums">
            {t("starsStreak", { stars: row.stars, streak: row.streak })}
          </span>
        ) : (
          "—"
        ),
      hideOnMobile: !rows.some((r) => r.role === "student"),
    },
    { id: "status", header: t("columns.status"), cell: statusBadge },
    {
      id: "lastLogin",
      header: t("columns.lastLogin"),
      cell: (row) => (row.lastLoginAt ? format.relativeTime(row.lastLoginAt) : t("never")),
    },
  ];

  const exportCsv = async () => {
    const filters = Object.fromEntries([...params.entries()].filter(([key]) => key !== "page"));
    const result = await exporter.execute({ scope, filters });
    if (!result.ok) return;
    const header = [t("columns.name"), t("columns.email"), t("columns.role"), t("columns.school"), t("export.grade"), t("export.section"), t("export.subject"), t("columns.class"), t("export.ministryId"), t("columns.status"), t("columns.lastLogin")];
    const lines = result.data.map((r) => [
      r.name,
      r.email,
      tRoles(r.role as AccountRole),
      r.school,
      r.grade,
      r.section,
      r.subject,
      r.classes,
      r.ministryId,
      t(`status.${r.status as "active" | "inactive" | "pending"}`),
      r.lastLoginAt ? r.lastLoginAt.slice(0, 10) : "",
    ]);
    downloadBlob(
      new Blob([buildCsv([header, ...lines])], { type: "text/csv;charset=utf-8" }),
      `accounts-${fileSlug(exportName, "school")}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  const toolbar = (
    <div className="flex flex-wrap gap-2">
      {creatableRoles.length > 0 && (
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <UserPlus aria-hidden />
          {t("create")}
        </Button>
      )}
      <Button variant="outline" onClick={() => void exportCsv()} disabled={exporter.pending || rows.length === 0}>
        {exporter.pending ? <Spinner /> : <Download aria-hidden />}
        {t("export.button")}
      </Button>
      {pendingRows.length > 0 && (
        <>
          <Button variant="outline" onClick={() => setSelected(new Set(pendingRows.map((r) => r.id)))}>
            {t("selectPending", { count: pendingRows.length })}
          </Button>
          <Button
            variant="secondary"
            disabled={selected.size === 0 || reissue.pending}
            onClick={() => void reissue.execute({ userIds: [...selected] })}
          >
            {reissue.pending ? <Spinner /> : <KeyRound aria-hidden />}
            {t("reissue", { count: selected.size })}
          </Button>
        </>
      )}
    </div>
  );

  const rowActions = (row: PersonRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("actionsFor", { name: row.name })}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setResetting(row)}>
          <RotateCcw aria-hidden />
          {t("actions.reset")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            setEditing(row);
            setFormOpen(true);
          }}
        >
          <Pencil aria-hidden />
          {t("actions.edit")}
        </DropdownMenuItem>
        {row.role === "teacher" && (
          <DropdownMenuItem onSelect={() => setTeacherId(row.id)}>
            <BookOpen aria-hidden />
            {t("actions.classes")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setToggling(row)}>
          <Power aria-hidden />
          {row.isActive ? t("actions.deactivate") : t("actions.activate")}
        </DropdownMenuItem>
        {canDelete && (
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(row)}>
            <Trash2 aria-hidden />
            {t("actions.delete")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchable={false}
        pageSize={rows.length || 1}
        toolbar={toolbar}
        rowActions={rowActions}
        caption={t("caption")}
        empty={<EmptyState icon={Users} title={t("empty.title")} description={t("empty.description")} action={toolbar} />}
      />

      <PersonFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        person={editing}
        roles={creatableRoles}
        classes={classes}
        schoolId={scope.kind === "school" ? scope.schoolId : undefined}
        schools={schools}
        onCreated={(c) => setCredentials([c])}
      />
      <AssignmentsDialog teacher={teacher} classes={classes} onOpenChange={(open) => !open && setTeacherId(null)} />
      <DeletePersonDialog person={deleting} onOpenChange={(open) => !open && setDeleting(null)} />

      <ConfirmDialog
        open={resetting !== null}
        onOpenChange={(open) => !open && setResetting(null)}
        title={t("resetConfirm.title", { name: resetting?.name ?? "" })}
        description={t("resetConfirm.description")}
        confirmLabel={t("actions.reset")}
        onConfirm={async () => {
          if (resetting) await reset.execute({ userId: resetting.id });
          setResetting(null);
        }}
      />
      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(open) => !open && setToggling(null)}
        title={
          toggling?.isActive
            ? t("deactivateConfirm.title", { name: toggling.name })
            : t("activateConfirm.title", { name: toggling?.name ?? "" })
        }
        description={toggling?.isActive ? t("deactivateConfirm.description") : t("activateConfirm.description")}
        confirmLabel={toggling?.isActive ? t("actions.deactivate") : t("actions.activate")}
        destructive={toggling?.isActive}
        onConfirm={async () => {
          if (toggling) await toggle.execute({ userId: toggling.id, isActive: !toggling.isActive });
          setToggling(null);
        }}
      />
      <CredentialsSheet rows={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}
