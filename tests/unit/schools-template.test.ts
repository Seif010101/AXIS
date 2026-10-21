import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { readSheet } from "@/server/services/files/spreadsheet";

process.env.SKIP_ENV_VALIDATION = "1";

// The blank template is downloaded in the viewer's language, so its headers must be ones
// the importer recognises, in every locale (regression: localized headers broke re-import).
describe("schools import template", () => {
  it.each(locales)("%s template headers import back", async (locale) => {
    const { SCHOOL_COLUMN_ALIASES } = await import("@/server/modules/schools/schools");
    const messages = JSON.parse(
      readFileSync(path.resolve(__dirname, `../../messages/${locale}/schools.json`), "utf8"),
    ) as { template: Record<string, string> };
    const t = messages.template;
    const csv = `${[t.school, t.branch, t.ministryCode, t.grade, t.section].join(",")}\n${t.sampleSchool},${t.sampleBranch},,5,A\n`;
    const sheet = await readSheet(new TextEncoder().encode(csv), {
      fileName: "x.csv",
      aliases: SCHOOL_COLUMN_ALIASES,
    });
    expect(sheet.headers.sort()).toEqual(["branch", "grade", "ministryCode", "school", "section"]);
  });
});
