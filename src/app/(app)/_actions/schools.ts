"use server";

import { refresh } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { action } from "@/server/action";
import { AppError } from "@/server/errors";
import {
  addClasses,
  addClassesSchema,
  deleteClass,
  deleteClassSchema,
} from "@/server/modules/schools/classes";
import {
  createSchool,
  deleteSchool,
  deleteSchoolSchema,
  importSchools,
  SCHOOL_COLUMN_ALIASES,
  schoolDeletionImpact,
  schoolFieldsSchema,
  updateSchool,
} from "@/server/modules/schools/schools";
import { buildWorkbook, readFormFile, readSheet } from "@/server/services/files";

// Server actions shared by the school screens (manager/owner school pages, admin classes).

export const createSchoolAction = action(
  { area: "manager", input: schoolFieldsSchema },
  async (fields, ctx) => {
    const created = await createSchool(ctx, fields);
    refresh();
    return created;
  },
);

export const updateSchoolAction = action(
  { area: "manager", input: schoolFieldsSchema.extend({ schoolId: z.uuid() }) },
  async ({ schoolId, ...fields }, ctx) => {
    await updateSchool(ctx, schoolId, fields);
    refresh();
  },
);

export const schoolImpactAction = action(
  { area: "manager", input: z.object({ schoolId: z.uuid() }) },
  (input, ctx) => schoolDeletionImpact(ctx, input.schoolId),
);

export const deleteSchoolAction = action(
  { area: "manager", stepUp: true, input: deleteSchoolSchema },
  async (input, ctx) => {
    await deleteSchool(ctx, input.schoolId, input.confirmName);
  },
);

// Bulk creation (up to 10,000 rows), so it needs a fresh authenticator code like the
// other high-impact actions.
export const importSchoolsAction = action(
  { area: "manager", stepUp: true, input: z.instanceof(FormData) },
  async (form, ctx) => {
    const file = await readFormFile(form, "file", { accept: [".xlsx", ".csv"] });
    const sheet = await readSheet(file.bytes, {
      fileName: file.fileName,
      aliases: SCHOOL_COLUMN_ALIASES,
      maxRows: 10_000,
    });
    if (!sheet.headers.includes("school") || !sheet.headers.includes("grade")) {
      const missing = (["school", "grade"] as const).filter((h) => !sheet.headers.includes(h));
      throw new AppError("VALIDATION", "Missing columns", {
        reason: "missing_columns",
        columns: missing.join(","),
      });
    }
    const result = await importSchools(ctx, sheet.rows, sheet.rowNumbers);
    refresh();
    return result;
  },
);

/** A ready-to-fill schools spreadsheet with localized headers (base64 .xlsx). */
export const schoolsTemplateAction = action({ area: "manager", input: z.object({}) }, async () => {
  const t = await getTranslations("schools.template");
  const locale = await getLocale();
  const buffer = await buildWorkbook([
    {
      name: t("schoolsSheet"),
      rtl: locale === "ar",
      columns: [
        { key: "school", header: t("school"), width: 28 },
        { key: "branch", header: t("branch") },
        { key: "code", header: t("ministryCode") },
        { key: "grade", header: t("grade"), width: 12 },
        { key: "section", header: t("section"), width: 12 },
      ],
      rows: [
        { school: t("sampleSchool"), branch: t("sampleBranch"), code: "", grade: "5", section: "A" },
        { school: t("sampleSchool"), branch: t("sampleBranch"), code: "", grade: "5", section: "B" },
        { school: t("sampleSchool"), branch: t("sampleBranch"), code: "", grade: "6", section: "" },
      ],
    },
  ]);
  return { base64: buffer.toString("base64") };
});

export const addClassesAction = action({ input: addClassesSchema }, async (input, ctx) => {
  const result = await addClasses(ctx, input);
  refresh();
  return result;
});

export const deleteClassAction = action({ input: deleteClassSchema }, async (input, ctx) => {
  await deleteClass(ctx, input);
  refresh();
});
