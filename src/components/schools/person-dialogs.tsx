"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  addAssignmentAction,
  createPersonAction,
  deletePersonAction,
  personImpactAction,
  removeAssignmentAction,
  updatePersonAction,
} from "@/app/(app)/_actions/people";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import type { PersonImpact, PersonRow } from "@/server/modules/schools/people";
import { decodeClass, encodeClass, type ClassOption } from "./class-options";
import type { CredentialRow } from "./credentials-sheet";

type AccountRole = PersonRow["role"];

function useClassLabel() {
  const t = useTranslations("schools.classes");
  return (c: ClassOption) => (c.section ? `${c.grade} / ${c.section}` : `${c.grade} · ${t("wholeGrade")}`);
}

function ClassSelect({
  id,
  value,
  onChange,
  classes,
  placeholder,
  allowNone,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  classes: ClassOption[];
  placeholder: string;
  allowNone?: string;
}) {
  const label = useClassLabel();
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">{allowNone}</SelectItem>}
        {classes.map((c) => (
          <SelectItem key={encodeClass(c)} value={encodeClass(c)}>
            {label(c)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------

interface FormState {
  role: AccountRole;
  name: string;
  ministryId: string;
  classValue: string;
  subject: string;
  schoolId: string;
}

/** Create an account (one-time password) or edit one (name, ID, class, subject). */
export function PersonFormDialog({
  open,
  onOpenChange,
  person,
  roles,
  classes,
  schoolId,
  schools,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode when set. */
  person?: PersonRow;
  /** Roles offered when creating. */
  roles: readonly AccountRole[];
  /** Classes of the school (for students' class and a teacher's first class). */
  classes: ClassOption[];
  /** The school new accounts join (school pages). */
  schoolId?: string;
  /** School choices for the owner directory (admins need a school). */
  schools?: { id: string; label: string }[];
  onCreated: (credentials: CredentialRow) => void;
}) {
  const t = useTranslations("schools.person");
  const tRoles = useTranslations("common.roles");
  const tCommon = useTranslations("common.actions");
  const [state, setState] = useState<FormState>({ role: roles[0] ?? "student", name: "", ministryId: "", classValue: "", subject: "", schoolId: "" });

  useEffect(() => {
    if (!open) return;
    setState(
      person
        ? {
            role: person.role,
            name: person.name,
            ministryId: person.ministryId ?? "",
            classValue: person.grade ? encodeClass({ grade: person.grade, section: person.section ?? "" }) : "",
            subject: person.subject ?? "",
            schoolId: person.schoolId ?? "",
          }
        : { role: roles[0] ?? "student", name: "", ministryId: "", classValue: "", subject: "", schoolId: "" },
    );
  }, [open, person, roles]);

  const create = useAction(createPersonAction, {
    onSuccess: (credentials) => {
      onOpenChange(false);
      onCreated(credentials);
    },
  });
  const update = useAction(updatePersonAction, { successMessage: t("updated"), onSuccess: () => onOpenChange(false) });
  const { pending, fieldErrors } = person ? update : create;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setState((s) => ({ ...s, [key]: value }));
  const chosen = state.classValue && state.classValue !== "none" ? decodeClass(state.classValue) : null;
  const needsClass = state.role === "student";
  const needsSchool = !person && !schoolId && state.role !== "manager";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const common = {
      name: state.name,
      ministryId: state.ministryId,
      grade: chosen?.grade ?? "",
      section: chosen?.section ?? "",
      subject: state.role === "teacher" ? state.subject : "",
    };
    if (person) void update.execute({ userId: person.id, ...common });
    else void create.execute({ ...common, role: state.role, schoolId: schoolId ?? (state.schoolId || undefined) });
  };

  const error = (field: string) => {
    const code = fieldErrors?.[field]?.[0];
    if (!code) return null;
    if (code === "CONFLICT") return t("errors.idInUse");
    if (field === "grade") return t("errors.class");
    return t("errors.invalid");
  };

  const disabled =
    pending || state.name.trim().length < 2 || (needsClass && !chosen) || (needsSchool && !state.schoolId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{person ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>{person ? t("editDescription") : t("createDescription")}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {!person && roles.length > 1 && (
              <Field>
                <FieldLabel htmlFor="person-role">{t("role")}</FieldLabel>
                <Select value={state.role} onValueChange={(v) => set("role", v as AccountRole)}>
                  <SelectTrigger id="person-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {tRoles(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field data-invalid={Boolean(error("name"))}>
              <FieldLabel htmlFor="person-name">{t("name")}</FieldLabel>
              <Input id="person-name" value={state.name} onChange={(e) => set("name", e.target.value)} maxLength={255} required autoComplete="off" />
              {error("name") && <FieldError>{error("name")}</FieldError>}
            </Field>
            <Field data-invalid={Boolean(error("ministryId"))}>
              <FieldLabel htmlFor="person-id">
                {t("ministryId")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
              </FieldLabel>
              <Input id="person-id" dir="ltr" value={state.ministryId} onChange={(e) => set("ministryId", e.target.value)} maxLength={50} autoComplete="off" />
              <FieldDescription>{t("ministryIdHint")}</FieldDescription>
              {error("ministryId") && <FieldError>{error("ministryId")}</FieldError>}
            </Field>
            {needsSchool && schools && (
              <Field>
                <FieldLabel htmlFor="person-school">{t("school")}</FieldLabel>
                <Select value={state.schoolId || undefined} onValueChange={(v) => set("schoolId", v)}>
                  <SelectTrigger id="person-school" className="w-full">
                    <SelectValue placeholder={t("chooseSchool")} />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {(state.role === "student" || (state.role === "teacher" && !person)) && (
              <Field data-invalid={Boolean(error("grade"))}>
                <FieldLabel htmlFor="person-class">{state.role === "student" ? t("class") : t("firstClass")}</FieldLabel>
                {classes.length === 0 ? (
                  <FieldDescription>{t("noClasses")}</FieldDescription>
                ) : (
                  <ClassSelect
                    id="person-class"
                    value={state.classValue}
                    onChange={(v) => set("classValue", v)}
                    classes={classes}
                    placeholder={t("chooseClass")}
                    allowNone={state.role === "teacher" ? t("noClassYet") : undefined}
                  />
                )}
                {error("grade") && <FieldError>{error("grade")}</FieldError>}
              </Field>
            )}
            {state.role === "teacher" && (
              <Field>
                <FieldLabel htmlFor="person-subject">
                  {t("subject")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
                </FieldLabel>
                <Input id="person-subject" value={state.subject} onChange={(e) => set("subject", e.target.value)} maxLength={100} />
              </Field>
            )}
          </FieldGroup>
          {!person && <p className="text-sm text-muted-foreground">{t("passwordNote")}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={disabled}>
              {pending && <Spinner />}
              {person ? tCommon("save") : t("createSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

/** A teacher's classes: list, add (existing class + subject), remove. */
export function AssignmentsDialog({
  teacher,
  classes,
  onOpenChange,
}: {
  teacher: PersonRow | null;
  classes: ClassOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("schools.assignments");
  const label = useClassLabel();
  const [classValue, setClassValue] = useState("");
  const [subject, setSubject] = useState("");
  const add = useAction(addAssignmentAction, {
    successMessage: t("added"),
    onSuccess: () => {
      setClassValue("");
      setSubject("");
    },
  });
  const remove = useAction(removeAssignmentAction, { successMessage: t("removed") });

  return (
    <Dialog open={teacher !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title", { name: teacher?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {teacher && (
          <div className="grid gap-5">
            {teacher.assignments.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {teacher.assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      {label(a)}
                      {a.subject && <Badge variant="secondary">{a.subject}</Badge>}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("remove")}
                      disabled={remove.pending}
                      onClick={() => void remove.execute({ teacherId: teacher.id, assignmentId: a.id })}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                const c = decodeClass(classValue);
                void add.execute({ teacherId: teacher.id, grade: c.grade, section: c.section, subject });
              }}
            >
              <Field>
                <FieldLabel htmlFor="assign-class">{t("class")}</FieldLabel>
                <ClassSelect id="assign-class" value={classValue} onChange={setClassValue} classes={classes} placeholder={t("chooseClass")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="assign-subject">{t("subject")}</FieldLabel>
                <Input id="assign-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={100} />
              </Field>
              <Button type="submit" disabled={!classValue || add.pending}>
                {add.pending ? <Spinner /> : <Plus aria-hidden />}
                {t("add")}
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

/** Permanent deletion with an impact summary; teachers with content must be deactivated. */
export function DeletePersonDialog({ person, onOpenChange }: { person: PersonRow | null; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("schools.deletePerson");
  const tCommon = useTranslations("common.actions");
  const [impact, setImpact] = useState<PersonImpact | null>(null);
  const load = useAction(personImpactAction, { onSuccess: setImpact });
  const remove = useAction(deletePersonAction, { successMessage: t("deleted"), onSuccess: () => onOpenChange(false) });
  const loadImpact = load.execute;

  useEffect(() => {
    setImpact(null);
    if (person) void loadImpact({ userId: person.id });
  }, [person, loadImpact]);

  const authored = impact ? impact.authored.homework + impact.authored.tests + impact.authored.worksheets : 0;
  const lines = useMemo(() => {
    if (!impact) return [];
    if (impact.role === "teacher") return [t("authored", { homework: impact.authored.homework, tests: impact.authored.tests, worksheets: impact.authored.worksheets })];
    if (impact.role === "student") return [t("studentData", { submissions: impact.submissions, results: impact.testResults, chats: impact.conversations })];
    return [];
  }, [impact, t]);

  return (
    <Dialog open={person !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { name: person?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {!impact ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <div className="grid gap-2 text-sm">
            {lines.map((line) => (
              <p key={line} className="rounded-md bg-muted/60 px-3 py-2">
                {line}
              </p>
            ))}
            {authored > 0 && <p className="font-medium text-destructive">{t("blocked")}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={!impact || authored > 0 || remove.pending}
            onClick={() => person && void remove.execute({ userId: person.id })}
          >
            {remove.pending && <Spinner />}
            {tCommon("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
