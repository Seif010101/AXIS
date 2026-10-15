"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { addClassesAction, deleteClassAction } from "@/app/(app)/_actions/schools";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import type { GradeGroup } from "@/server/modules/schools/classes";

/** The school's grades and sections: add several sections at once, remove unused ones. */
export function ClassesCard({ groups, schoolId }: { groups: GradeGroup[]; schoolId?: string }) {
  const t = useTranslations("schools.classes");
  const [grade, setGrade] = useState("");
  const [sections, setSections] = useState("");
  const [removing, setRemoving] = useState<{ grade: string; section: string } | null>(null);

  const add = useAction(addClassesAction, {
    onSuccess: ({ added, existing }) => {
      setGrade("");
      setSections("");
      toast.success(t("added", { added, existing }));
    },
  });
  const remove = useAction(deleteClassAction, {
    silent: true,
    successMessage: t("deleted"),
    onError: (failure) =>
      toast.error(
        failure.details?.reason === "class_in_use"
          ? t("inUse", { students: Number(failure.details.students ?? 0), assignments: Number(failure.details.assignments ?? 0) })
          : t("deleteFailed"),
      ),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void add.execute({ schoolId, grade, sections });
  };

  const total = groups.reduce((sum, g) => sum + g.classes.length, 0);

  return (
    <SectionCard title={t("title")} description={t("description", { count: total })}>
      <div className="grid gap-5">
        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="grid gap-3">
            {groups.map((group) => (
              <div key={group.grade} className="rounded-lg border p-3">
                <p className="mb-2 font-medium">{t("grade", { grade: group.grade })}</p>
                <ul className="flex flex-wrap gap-2">
                  {group.classes.map((c) => (
                    <li
                      key={`${c.grade}|${c.section}`}
                      className="flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 ps-3 pe-1 text-sm"
                    >
                      <span>{c.section || t("wholeGrade")}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("counts", { students: c.students, assignments: c.assignments })}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 rounded-full"
                        aria-label={t("remove", { name: c.section || t("wholeGrade") })}
                        onClick={() => setRemoving({ grade: c.grade, section: c.section })}
                      >
                        <X className="size-3.5" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <Field>
            <FieldLabel htmlFor="class-grade">{t("gradeLabel")}</FieldLabel>
            <Input id="class-grade" value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={50} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="class-sections">{t("sectionsLabel")}</FieldLabel>
            <Input id="class-sections" value={sections} onChange={(e) => setSections(e.target.value)} placeholder={t("sectionsPlaceholder")} />
            <FieldDescription>{t("sectionsHint")}</FieldDescription>
          </Field>
          <Button type="submit" disabled={!grade.trim() || add.pending} className="sm:mb-6">
            {add.pending ? <Spinner /> : <Plus aria-hidden />}
            {t("add")}
          </Button>
        </form>
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeTitle")}
        description={t("removeDescription")}
        destructive
        onConfirm={async () => {
          if (removing) await remove.execute({ schoolId, ...removing });
          setRemoving(null);
        }}
      />
    </SectionCard>
  );
}
