import { describe, expect, it } from "vitest";
import { clean, emailCandidates, escapeLike, foldKey, idSlug, naturalCompare, splitList } from "@/server/modules/schools/naming";

describe("schools naming helpers", () => {
  it("cleans and folds Arabic and Latin text", () => {
    expect(clean("  الصف   الخامس‏ ")).toBe("الصف الخامس");
    expect(foldKey("الشُّعبة")).toBe(foldKey("الشعبه"));
    expect(foldKey("إداري")).toBe(foldKey("اداري"));
    expect(foldKey("Grade_5")).toBe("grade 5");
    expect(foldKey("٥")).toBe("5");
    expect(foldKey("۷")).toBe("7");
  });

  it("builds email candidates from the ministry ID or a numbered role", () => {
    expect(idSlug("S-1/0٥")).toBe("s105");
    expect(emailCandidates("AXIS", "student", "S-10", 1, 3)).toEqual(["axiss10", "axiss10.2", "axiss10.3"]);
    expect(emailCandidates("AXIS", "teacher", null, 4, 2)).toEqual(["axis.teacher4", "axis.teacher5"]);
    expect(emailCandidates("AXIS", "admin", "!!", 1, 1)).toEqual(["axis.admin1"]);
  });

  it("splits section lists on commas, Arabic commas and new lines", () => {
    expect(splitList("A, B،C\n a ,")).toEqual(["A", "B", "C"]);
  });

  it("escapes LIKE wildcards and sorts naturally", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
    expect(["10", "2", "1"].sort(naturalCompare)).toEqual(["1", "2", "10"]);
  });
});
