"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { createSchoolAction, updateSchoolAction } from "@/app/(app)/_actions/schools";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

export interface SchoolFormValues {
  name: string;
  branch: string;
  ministryCode: string;
}

/** Create a school (then open it) or edit one; duplicate name/branch and codes are flagged per field. */
export function SchoolFormDialog({ school }: { school?: SchoolFormValues & { id: string } }) {
  const t = useTranslations("schools.form");
  const tCommon = useTranslations("common.actions");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<SchoolFormValues>({ name: "", branch: "", ministryCode: "" });

  const create = useAction(createSchoolAction, {
    successMessage: t("created"),
    onSuccess: ({ id }) => {
      setOpen(false);
      router.push(`/manager/schools/${id}`);
    },
  });
  const update = useAction(updateSchoolAction, { successMessage: t("updated"), onSuccess: () => setOpen(false) });
  const { pending, fieldErrors } = school ? update : create;

  const onOpenChange = (next: boolean) => {
    if (next) setValues(school ? { name: school.name, branch: school.branch, ministryCode: school.ministryCode } : { name: "", branch: "", ministryCode: "" });
    setOpen(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (school) void update.execute({ schoolId: school.id, ...values });
    else void create.execute(values);
  };

  const errorFor = (field: keyof SchoolFormValues) => {
    const code = fieldErrors?.[field]?.[0];
    if (!code) return null;
    if (code === "CONFLICT") return field === "ministryCode" ? t("errors.codeInUse") : t("errors.duplicate");
    return t("errors.invalid");
  };

  const field = (name: keyof SchoolFormValues, label: string, optional: boolean, maxLength: number) => (
    <Field data-invalid={Boolean(errorFor(name))}>
      <FieldLabel htmlFor={`school-${name}`}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">{t("optional")}</span>}
      </FieldLabel>
      <Input
        id={`school-${name}`}
        value={values[name]}
        onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
        maxLength={maxLength}
        required={!optional}
        aria-invalid={Boolean(errorFor(name))}
        autoComplete="off"
      />
      {errorFor(name) && <FieldError>{errorFor(name)}</FieldError>}
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {school ? (
          <Button variant="outline">
            <Pencil aria-hidden />
            {tCommon("edit")}
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden />
            {t("createButton")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{school ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {field("name", t("name"), false, 200)}
            {field("branch", t("branch"), true, 100)}
            {field("ministryCode", t("ministryCode"), true, 50)}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !values.name.trim()}>
              {pending && <Spinner />}
              {school ? tCommon("save") : tCommon("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
