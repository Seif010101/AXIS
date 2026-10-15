"use client";

import { Download, FileSpreadsheet, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { deleteSchoolAction, importSchoolsAction, schoolImpactAction, schoolsTemplateAction } from "@/app/(app)/_actions/schools";
import { FileUpload } from "@/components/common/file-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import type { SchoolImpact, SchoolImportResult } from "@/server/modules/schools/schools";
import { downloadBase64 } from "./list-controls";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Upload a spreadsheet of schools (one row per class) and show an exact per-school report. */
export function ImportSchoolsDialog() {
  const t = useTranslations("schools.import");
  const tCommon = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SchoolImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importer = useAction(importSchoolsAction, {
    silent: true,
    onSuccess: setResult,
    onError: (failure) => {
      const reason = failure.details?.reason;
      if (reason === "missing_columns") setError(t("errors.missingColumns"));
      else if (reason === "no_schools") setError(t("errors.noSchools"));
      else if (failure.code === "VALIDATION") setError(t("errors.file"));
      else setError(t("errors.generic"));
    },
  });
  const template = useAction(schoolsTemplateAction, {
    onSuccess: ({ base64 }) => downloadBase64(base64, "schools-template.xlsx", XLSX_MIME),
  });

  const created = result?.schools.filter((s) => s.status === "created").length ?? 0;
  const existing = result?.schools.filter((s) => s.status === "existing").length ?? 0;
  const classes = result?.schools.reduce((sum, s) => sum + s.classesAdded, 0) ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setResult(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet aria-hidden />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="grid gap-4">
            <p className="font-medium">{t("summary", { created, existing, classes })}</p>
            <ul className="max-h-48 divide-y overflow-auto rounded-lg border text-sm">
              {result.schools.map((s) => (
                <li key={`${s.name}|${s.branch ?? ""}`} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>{s.branch ? `${s.name} — ${s.branch}` : s.name}</span>
                  <Badge variant={s.status === "created" ? "default" : "secondary"}>
                    {t(`status.${s.status}`)} · {t("classesAdded", { count: s.classesAdded })}
                  </Badge>
                </li>
              ))}
            </ul>
            {result.issues.length > 0 && (
              <div className="grid gap-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <p className="font-medium">{t("issuesTitle", { count: result.issues.length })}</p>
                <ul className="max-h-32 list-inside list-disc overflow-auto">
                  {result.issues.map((issue, i) => (
                    <li key={i}>
                      {t("row", { row: issue.row })}: {t(`issues.${issue.code}`, { value: "value" in issue ? issue.value : "" })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t("columnsTitle")}</p>
              <p>{t("columns")}</p>
              <p className="mt-1">{t("note")}</p>
            </div>
            <FileUpload
              accept={[".xlsx", ".csv"]}
              maxBytes={8 * 1024 * 1024}
              label={t("drop")}
              onFile={async (file) => {
                setError(null);
                const form = new FormData();
                form.append("file", file);
                await importer.execute(form);
              }}
            />
            {importer.pending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> {t("processing")}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => void template.execute({})} disabled={template.pending}>
            {template.pending ? <Spinner /> : <Download aria-hidden />}
            {t("template")}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tCommon("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Delete a school: shows what disappears and requires typing the school's name. */
export function DeleteSchoolDialog({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const t = useTranslations("schools.deleteSchool");
  const tCommon = useTranslations("common.actions");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [impact, setImpact] = useState<SchoolImpact | null>(null);
  const load = useAction(schoolImpactAction, { onSuccess: setImpact });
  const remove = useAction(deleteSchoolAction, {
    successMessage: t("deleted"),
    onSuccess: () => {
      setOpen(false);
      router.push("/manager/schools");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setTyped("");
        if (next) {
          setImpact(null);
          void load.execute({ schoolId });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive">
          <Trash2 aria-hidden />
          {tCommon("delete")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { name: schoolName })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {impact ? (
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {(["students", "teachers", "admins", "classes", "homework", "tests", "worksheets"] as const).map((key) => (
              <li key={key} className="flex justify-between rounded-md bg-muted/60 px-3 py-1.5">
                <span>{t(`impact.${key}`)}</span>
                <span className="font-semibold tabular-nums">{impact[key]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Skeleton className="h-24 w-full" />
        )}
        <Field>
          <FieldLabel htmlFor="confirm-school-name">{t("typeName")}</FieldLabel>
          <Input id="confirm-school-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          <FieldDescription>{schoolName}</FieldDescription>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tCommon("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={typed.trim() !== schoolName.trim() || remove.pending || !impact}
            onClick={() => void remove.execute({ schoolId, confirmName: typed })}
          >
            {remove.pending && <Spinner />}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
