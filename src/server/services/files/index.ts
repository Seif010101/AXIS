import "server-only";

// Files that pass through the server: text extraction for AI, spreadsheet import/export,
// download headers and files posted to server actions. Large files live in storage
// (`@/server/services/storage`) and only reach this module through readObject().

export { contentDisposition, sanitizeFileName } from "./disposition";
export {
  decodeText,
  EXTRACTABLE_EXTENSIONS,
  extractableKind,
  extractText,
  truncateText,
  type ExtractableKind,
  type ExtractedText,
} from "./extract";
export { FORM_FILE_MAX_BYTES, isAccepted, readFormFile, type UploadedFile } from "./form-file";
export {
  buildWorkbook,
  cellText,
  normalizeHeader,
  parseCsv,
  readSheet,
  SHEET_MAX_BYTES,
  toCsv,
  XLSX_MIME,
  type CellInput,
  type CsvValue,
  type ReadSheetOptions,
  type SheetData,
  type WorkbookColumn,
  type WorkbookSheet,
} from "./spreadsheet";
export { MAX_UNCOMPRESSED_BYTES } from "./zip";
