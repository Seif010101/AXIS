// Pure search/sort/pagination logic behind <DataTable/>. Unit-tested in tests/unit/shell-data-table.test.ts.

export type SortDirection = "asc" | "desc";
export type SortValue = string | number | boolean | Date | null | undefined;

export interface SortState {
  id: string;
  direction: SortDirection;
}

/**
 * Lower-cases and folds the variants people type interchangeably, so a search for "احمد"
 * finds "أحمد" and accents don't matter ("eleve" finds "élève").
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // Latin accents
    .replace(/[ً-ٰٟـ]/g, "") // Arabic diacritics and tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase()
    .trim();
}

/** Rows whose searchable text contains every word of the query. */
export function filterRows<T>(rows: readonly T[], query: string, getTexts: ((row: T) => string)[]): T[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0 || getTexts.length === 0) return [...rows];
  return rows.filter((row) => {
    const haystack = normalizeSearch(getTexts.map((get) => get(row)).join(" "));
    return words.every((word) => haystack.includes(word));
  });
}

/** Compares two sort values; empty values always sort last, whatever the direction. */
export function compareSortValues(a: SortValue, b: SortValue, collator: Intl.Collator): number {
  const emptyA = a === null || a === undefined || a === "";
  const emptyB = b === null || b === undefined || b === "";
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
}

/** Stable sort by one column. */
export function sortRows<T>(
  rows: readonly T[],
  getValue: (row: T) => SortValue,
  direction: SortDirection,
  collator: Intl.Collator,
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: getValue(row) }))
    .sort((x, y) => {
      const xEmpty = x.value === null || x.value === undefined || x.value === "";
      const yEmpty = y.value === null || y.value === undefined || y.value === "";
      const compared = xEmpty || yEmpty ? compareSortValues(x.value, y.value, collator) : factor * compareSortValues(x.value, y.value, collator);
      return compared || x.index - y.index;
    })
    .map(({ row }) => row);
}

/** Next sort state when a column header is clicked: asc → desc → off. */
export function nextSort(current: SortState | null, id: string): SortState | null {
  if (!current || current.id !== id) return { id, direction: "asc" };
  return current.direction === "asc" ? { id, direction: "desc" } : null;
}

export interface Page<T> {
  rows: T[];
  /** 1-based, clamped to the available pages. */
  page: number;
  pageCount: number;
  total: number;
  /** 1-based index of the first row shown (0 when empty). */
  from: number;
  to: number;
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (current - 1) * size;
  const slice = rows.slice(start, start + size);
  return {
    rows: slice,
    page: current,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}
