import { describe, expect, it } from "vitest";
import {
  compareSortValues,
  filterRows,
  nextSort,
  normalizeSearch,
  paginate,
  sortRows,
} from "@/components/common/data-table-logic";

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

describe("data table search", () => {
  it("folds Arabic letter variants, diacritics and Latin accents", () => {
    expect(normalizeSearch("أحمد")).toBe(normalizeSearch("احمد"));
    expect(normalizeSearch("إسلام")).toBe("اسلام");
    expect(normalizeSearch("مُحَمَّد")).toBe("محمد");
    expect(normalizeSearch("مكتبة")).toBe(normalizeSearch("مكتبه"));
    expect(normalizeSearch("مصطفى")).toBe(normalizeSearch("مصطفي"));
    expect(normalizeSearch("  Élève ")).toBe("eleve");
  });

  it("keeps rows that contain every word of the query across columns", () => {
    const rows = [
      { name: "أحمد علي", grade: "7" },
      { name: "Sara Ali", grade: "8" },
      { name: "Omar", grade: "7" },
    ];
    type Row = (typeof rows)[number];
    const texts = [(row: Row) => row.name, (row: Row) => row.grade];
    expect(filterRows(rows, "احمد", texts)).toEqual([rows[0]]);
    expect(filterRows(rows, "ali 8", texts)).toEqual([rows[1]]);
    expect(filterRows(rows, "7", texts)).toEqual([rows[0], rows[2]]);
    expect(filterRows(rows, "   ", texts)).toEqual(rows);
    expect(filterRows(rows, "nobody", texts)).toEqual([]);
  });
});

describe("data table sorting", () => {
  it("compares numbers, dates, booleans and text", () => {
    expect(compareSortValues(2, 10, collator)).toBeLessThan(0);
    expect(compareSortValues(new Date("2026-01-02"), new Date("2026-01-01"), collator)).toBeGreaterThan(0);
    expect(compareSortValues(false, true, collator)).toBeLessThan(0);
    expect(compareSortValues("item 2", "item 10", collator)).toBeLessThan(0);
  });

  it("puts empty values last in both directions and keeps ties stable", () => {
    const rows = [
      { id: "a", score: 5 },
      { id: "b", score: null },
      { id: "c", score: 9 },
      { id: "d", score: 5 },
    ];
    const ids = (list: typeof rows) => list.map((row) => row.id).join("");
    expect(ids(sortRows(rows, (row) => row.score, "asc", collator))).toBe("adcb");
    expect(ids(sortRows(rows, (row) => row.score, "desc", collator))).toBe("cadb");
    expect(ids(rows)).toBe("abcd"); // the input is not mutated
  });

  it("cycles a column through ascending, descending and off", () => {
    expect(nextSort(null, "name")).toEqual({ id: "name", direction: "asc" });
    expect(nextSort({ id: "name", direction: "asc" }, "name")).toEqual({ id: "name", direction: "desc" });
    expect(nextSort({ id: "name", direction: "desc" }, "name")).toBeNull();
    expect(nextSort({ id: "name", direction: "desc" }, "date")).toEqual({ id: "date", direction: "asc" });
  });
});

describe("data table pagination", () => {
  const rows = Array.from({ length: 23 }, (_, i) => i + 1);

  it("slices pages and reports the visible range", () => {
    expect(paginate(rows, 1, 10)).toMatchObject({ page: 1, pageCount: 3, total: 23, from: 1, to: 10 });
    const last = paginate(rows, 3, 10);
    expect(last.rows).toEqual([21, 22, 23]);
    expect(last).toMatchObject({ from: 21, to: 23 });
  });

  it("clamps out-of-range pages and handles empty lists", () => {
    expect(paginate(rows, 99, 10).page).toBe(3);
    expect(paginate(rows, 0, 10).page).toBe(1);
    expect(paginate([], 1, 10)).toEqual({ rows: [], page: 1, pageCount: 1, total: 0, from: 0, to: 0 });
    expect(paginate(rows, 1, 0).rows).toEqual([1]);
  });
});
