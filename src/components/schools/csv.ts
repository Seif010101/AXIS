// Client-side CSV for downloads built in the browser (credentials sheets, exports).
// One UTF-8 BOM so Excel opens Arabic correctly, CRLF line ends, quotes doubled, and cells
// that a spreadsheet would run as a formula (= + - @ tab CR) prefixed with an apostrophe.

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n']/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** A file-name-safe ASCII slug ("مدرسة النور" → "school"). */
export function fileSlug(value: string, fallback: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
  return slug || fallback;
}
