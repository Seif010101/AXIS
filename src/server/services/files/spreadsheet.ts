import "server-only";
import ExcelJS from "exceljs";
import { AppError } from "@/server/errors";
import { loadZipSafely } from "./zip";

// Spreadsheet import/export: Excel imports (people, classes), reports and CSV exports.

/** Default maximum size of an uploaded spreadsheet. */
export const SHEET_MAX_BYTES = 8 * 1024 * 1024;

/** Opens an .xlsx workbook (after the zip-bomb check). */
export async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  await loadZipSafely(bytes);
  const workbook = new ExcelJS.Workbook();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  await workbook.xlsx.load(buffer);
  return workbook;
}

function dateText(date: Date): string {
  const iso = date.toISOString();
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
}

/** The display text of an ExcelJS cell value (formulas give their result, dates ISO). */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return dateText(value);
  if ("richText" in value)
    return value.richText
      .map((run) => run.text)
      .join("")
      .trim();
  if ("hyperlink" in value) return String(value.text ?? "").trim();
  if ("formula" in value || "sharedFormula" in value) {
    const result = value.result;
    if (result === undefined || result === null) return "";
    if (typeof result === "object" && !(result instanceof Date)) return "";
    return cellText(result);
  }
  return "";
}

const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/**
 * Normalizes a header for matching: Unicode NFKC, trimmed, single spaces, lowercase,
 * Arabic diacritics and tatweel removed, alef/yeh/teh-marbuta variants unified, trailing
 * ":" or "*" dropped. "  الاسمُ الكامل: " and "الاسم الكامل" match.
 */
export function normalizeHeader(text: string): string {
  return text
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\s_]+/g, " ")
    .trim()
    .replace(/[\s:*]+$/g, "")
    .toLowerCase();
}

export interface ReadSheetOptions {
  /**
   * Canonical key → accepted header spellings in any language. A column whose header
   * matches an alias is returned under the key; other columns keep their normalized header.
   * @example { name: ["name", "student name", "الاسم"], grade: ["grade", "الصف"] }
   */
  aliases?: Readonly<Record<string, readonly string[]>>;
  /** Maximum data rows (default 5000); more is a VALIDATION error. */
  maxRows?: number;
  /** Maximum columns (default 100). */
  maxColumns?: number;
  /** Maximum file size (default 8 MB). */
  maxBytes?: number;
  /** Worksheet name or 1-based position (default: the first sheet). */
  sheet?: string | number;
  /** "csv" for CSV files; .xlsx otherwise. Pass the uploaded file's name to decide. */
  fileName?: string;
}

export interface SheetData {
  /** Column keys in sheet order (canonical alias keys or normalized headers). */
  headers: string[];
  /** One record per non-empty data row; every header is present (empty string if blank). */
  rows: Record<string, string>[];
  /** The 1-based sheet row number of each record, for error messages ("row 12: …"). */
  rowNumbers: number[];
}

/** Splits CSV text (RFC 4180; comma, semicolon or tab delimited). */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.slice(0, source.search(/\r?\n|$/));
  const delimiter = [",", ";", "\t"].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function readGrid(bytes: Uint8Array, options: ReadSheetOptions, maxRows: number): Promise<string[][]> {
  if (/\.csv$/i.test(options.fileName ?? "")) {
    return parseCsv(new TextDecoder("utf-8").decode(bytes)).map((cells) => cells.map((cell) => cell.trim()));
  }
  let workbook: ExcelJS.Workbook;
  try {
    workbook = await loadWorkbook(bytes);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("VALIDATION", "The spreadsheet could not be read", { reason: "unreadable" });
  }
  const sheet =
    options.sheet === undefined
      ? workbook.worksheets[0]
      : typeof options.sheet === "number"
        ? workbook.worksheets[options.sheet - 1]
        : workbook.getWorksheet(options.sheet);
  if (!sheet) throw new AppError("VALIDATION", "Worksheet not found", { reason: "no_sheet" });
  if (sheet.actualRowCount > maxRows + 1) {
    throw new AppError("VALIDATION", "Too many rows", { reason: "too_many_rows", maxRows });
  }
  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cells[column - 1] = cellText(cell.value);
    });
    grid[rowNumber - 1] = Array.from(cells, (cell) => cell ?? "");
  });
  return Array.from(grid, (cells) => cells ?? []);
}

/**
 * Reads the first (or chosen) worksheet of an .xlsx file, or a CSV file, into records keyed
 * by normalized headers (the first non-empty row). Throws VALIDATION with `details.reason`:
 * "too_large", "unreadable", "no_sheet", "no_header", "duplicate_header", "too_many_rows",
 * "too_many_columns".
 *
 * @example
 * const { rows, rowNumbers } = await readSheet(file.bytes, {
 *   fileName: file.fileName,
 *   aliases: { name: ["name", "الاسم"], grade: ["grade", "الصف"] },
 * });
 */
export async function readSheet(bytes: Uint8Array, options: ReadSheetOptions = {}): Promise<SheetData> {
  const maxBytes = options.maxBytes ?? SHEET_MAX_BYTES;
  const maxRows = options.maxRows ?? 5000;
  const maxColumns = options.maxColumns ?? 100;
  if (bytes.byteLength > maxBytes) {
    throw new AppError("VALIDATION", "The spreadsheet is too large", { reason: "too_large", maxBytes });
  }
  const grid = await readGrid(bytes, options, maxRows);
  const headerIndex = grid.findIndex((cells) => cells.some((cell) => cell.trim() !== ""));
  if (headerIndex < 0)
    throw new AppError("VALIDATION", "The spreadsheet has no header row", { reason: "no_header" });

  const aliasToKey = new Map<string, string>();
  for (const [key, spellings] of Object.entries(options.aliases ?? {})) {
    for (const spelling of [key, ...spellings]) aliasToKey.set(normalizeHeader(spelling), key);
  }

  const headerCells = grid[headerIndex];
  if (headerCells.length > maxColumns) {
    throw new AppError("VALIDATION", "Too many columns", { reason: "too_many_columns", maxColumns });
  }
  const columns: { index: number; key: string }[] = [];
  const seen = new Set<string>();
  headerCells.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;
    const key = aliasToKey.get(normalized) ?? normalized;
    if (seen.has(key)) {
      throw new AppError("VALIDATION", "Duplicate column", {
        reason: "duplicate_header",
        header: cell.trim(),
      });
    }
    seen.add(key);
    columns.push({ index, key });
  });

  const rows: Record<string, string>[] = [];
  const rowNumbers: number[] = [];
  for (let index = headerIndex + 1; index < grid.length; index++) {
    const cells = grid[index] ?? [];
    if (!cells.some((cell) => cell.trim() !== "")) continue;
    if (rows.length >= maxRows) {
      throw new AppError("VALIDATION", "Too many rows", { reason: "too_many_rows", maxRows });
    }
    rows.push(Object.fromEntries(columns.map((column) => [column.key, (cells[column.index] ?? "").trim()])));
    rowNumbers.push(index + 1);
  }
  return { headers: columns.map((column) => column.key), rows, rowNumbers };
}

export type CellInput = string | number | boolean | Date | null | undefined;

export interface WorkbookColumn {
  /** Property of each row to show in this column. */
  key: string;
  /** Header text (already translated). */
  header: string;
  /** Column width in characters (default 18). */
  width?: number;
}

export interface WorkbookSheet {
  /** Sheet tab name; cleaned of characters Excel forbids and cut to 31 characters. */
  name: string;
  columns: readonly WorkbookColumn[];
  rows: readonly Readonly<Record<string, CellInput>>[];
  /** Right-to-left sheet (Arabic exports). */
  rtl?: boolean;
}

function sheetName(name: string, used: Set<string>): string {
  const base =
    name
      .replace(/[[\]:*?/\\]/g, " ")
      .replace(/^'+|'+$/g, "")
      .trim()
      .slice(0, 31) || "Sheet";
  let candidate = base;
  for (let suffix = 2; used.has(candidate.toLowerCase()); suffix++) {
    candidate = `${base.slice(0, 31 - String(suffix).length - 1)} ${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Builds an .xlsx file: one sheet per entry, bold frozen header row, optional RTL layout.
 * Strings are stored as text, never as formulas.
 *
 * @example
 * const xlsx = await buildWorkbook([{ name: t("sheet"), rtl: locale === "ar", columns, rows }]);
 * return new Response(xlsx, { headers: { "Content-Type": XLSX_MIME, "Content-Disposition": contentDisposition("report.xlsx") } });
 */
export async function buildWorkbook(sheets: readonly WorkbookSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const used = new Set<string>();
  for (const definition of sheets) {
    const sheet = workbook.addWorksheet(sheetName(definition.name, used), {
      views: [{ state: "frozen", ySplit: 1, rightToLeft: Boolean(definition.rtl) }],
    });
    sheet.columns = definition.columns.map((column) => ({
      key: column.key,
      header: column.header,
      width: column.width ?? 18,
    }));
    sheet.getRow(1).font = { bold: true };
    for (const row of definition.rows) {
      sheet.addRow(
        Object.fromEntries(
          definition.columns.map((column) => {
            const value = row[column.key];
            return [column.key, value === undefined ? null : value];
          }),
        ),
      );
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** MIME type of .xlsx files. */
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type CsvValue = string | number | boolean | Date | null | undefined;

function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text =
    value instanceof Date
      ? dateText(value)
      : typeof value === "string"
        ? value.replace(/﻿/g, "")
        : String(value);
  // Spreadsheet formula injection: text starting with = + - @ (or tab/CR) would run as a
  // formula when the CSV is opened in Excel. Prefix it so it stays text.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n;]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV text with one UTF-8 BOM (so Excel opens Arabic correctly), CRLF line endings, quoting
 * per RFC 4180 and formula-injection protection. The first row is usually the header.
 *
 * @example
 * return new Response(toCsv([[t("name"), t("grade")], ...students.map((s) => [s.name, s.grade])]), {
 *   headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": contentDisposition("students.csv") },
 * });
 */
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return `﻿${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;
}
