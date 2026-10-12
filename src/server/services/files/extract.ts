import "server-only";
import type JSZip from "jszip";
import { AppError } from "@/server/errors";
import { cellText, loadWorkbook } from "./spreadsheet";
import { loadZipSafely } from "./zip";

// Text extraction for AI features (book summaries, chat attachments, worksheet sources).
// Formats are recognized by extension first, then MIME type. Legacy binary Office formats
// (.doc, .ppt, .xls) are not supported: users re-save them as .docx/.pptx/.xlsx.

export type ExtractableKind = "pdf" | "docx" | "pptx" | "xlsx" | "txt" | "csv" | "md";

const BY_EXTENSION: Record<string, ExtractableKind> = {
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
  xlsx: "xlsx",
  txt: "txt",
  csv: "csv",
  md: "md",
  markdown: "md",
};

const BY_MIME: Record<string, ExtractableKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "text/csv": "csv",
  "text/markdown": "md",
};

/** Extensions extractText() accepts, e.g. for a file picker's `accept`. */
export const EXTRACTABLE_EXTENSIONS = Object.keys(BY_EXTENSION).map((extension) => `.${extension}`);

/** The kind of a file, or null when extractText() can't read it. */
export function extractableKind(fileName: string, mimeType?: string | null): ExtractableKind | null {
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase();
  if (extension && BY_EXTENSION[extension]) return BY_EXTENSION[extension];
  const mime = mimeType?.split(";")[0].trim().toLowerCase();
  return (mime && BY_MIME[mime]) || null;
}

/** Decodes text bytes: UTF-8 (BOM stripped) or UTF-16 with a BOM. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
}

/** Cuts text to at most `maxChars` without splitting a surrogate pair. */
export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  let end = Math.max(0, maxChars);
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1; // high surrogate: drop the half pair
  return { text: text.slice(0, end), truncated: true };
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, name: string) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return XML_ENTITIES[name.toLowerCase()] ?? entity;
  });
}

/** Paragraph texts of a DrawingML part (slides): <a:p> paragraphs made of <a:t> runs. */
function drawingText(xml: string): string {
  const paragraphs = xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? [];
  return paragraphs
    .map((paragraph) =>
      (paragraph.match(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g) ?? [])
        .map((run) => decodeXml(run.replace(/^<a:t(?:\s[^>]*)?>|<\/a:t>$/g, "")))
        .join(""),
    )
    .filter((line) => line.trim() !== "")
    .join("\n");
}

/** Slide part paths in presentation order (falls back to the slide number). */
async function slidePaths(zip: JSZip): Promise<string[]> {
  const found = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path));
  const byNumber = [...found].sort(
    (a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]),
  );
  const presentation = await zip.file("ppt/presentation.xml")?.async("string");
  const rels = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  if (!presentation || !rels) return byNumber;
  const targets = new Map<string, string>();
  for (const match of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(match[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(match[0])?.[1];
    if (id && target) targets.set(id, `ppt/${target.replace(/^\/?ppt\//, "").replace(/^\.\//, "")}`);
  }
  const ordered: string[] = [];
  for (const match of presentation.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)) {
    const path = targets.get(match[1]);
    if (path && found.includes(path) && !ordered.includes(path)) ordered.push(path);
  }
  return [...ordered, ...byNumber.filter((path) => !ordered.includes(path))];
}

async function pptxText(bytes: Uint8Array): Promise<string> {
  const zip = await loadZipSafely(bytes);
  const slides: string[] = [];
  for (const path of await slidePaths(zip)) {
    const xml = await zip.file(path)?.async("string");
    const text = xml ? drawingText(xml) : "";
    if (text) slides.push(text);
  }
  return slides.join("\n\n");
}

async function docxText(bytes: Uint8Array): Promise<string> {
  await loadZipSafely(bytes);
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
  // pdf.js may transfer (detach) the buffer it is given: hand it a copy.
  const document = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const { text } = await pdfExtract(document, { mergePages: false });
    return text.join("\n\n");
  } finally {
    await document.loadingTask.destroy();
  }
}

async function xlsxText(bytes: Uint8Array): Promise<string> {
  const workbook = await loadWorkbook(bytes);
  const sheets: string[] = [];
  workbook.eachSheet((sheet) => {
    const lines: string[] = [];
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => cells.push(cellText(cell.value)));
      const line = cells.join("\t").trimEnd();
      if (line) lines.push(line);
    });
    if (lines.length > 0) sheets.push(`# ${sheet.name}\n${lines.join("\n")}`);
  });
  return sheets.join("\n\n");
}

export interface ExtractedText {
  text: string;
  /** True when the text was cut at `maxChars`. */
  truncated: boolean;
  kind: ExtractableKind;
}

/**
 * Plain text of a PDF, Word (.docx), PowerPoint (.pptx, slides in order), Excel (.xlsx),
 * text, CSV or Markdown file, whitespace-normalized and cut at `maxChars`. Throws
 * VALIDATION for unsupported or unreadable files.
 *
 * @example
 * const { text, truncated } = await extractText({ bytes, fileName: file.name, mimeType: file.type, maxChars: 60_000 });
 */
export async function extractText(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType?: string | null;
  maxChars: number;
}): Promise<ExtractedText> {
  const kind = extractableKind(input.fileName, input.mimeType);
  if (!kind) throw new AppError("VALIDATION", "Unsupported file type", { reason: "unsupported_type" });
  if (!Number.isInteger(input.maxChars) || input.maxChars <= 0) {
    throw new AppError("VALIDATION", "maxChars must be a positive integer");
  }
  let raw: string;
  try {
    switch (kind) {
      case "pdf":
        raw = await pdfText(input.bytes);
        break;
      case "docx":
        raw = await docxText(input.bytes);
        break;
      case "pptx":
        raw = await pptxText(input.bytes);
        break;
      case "xlsx":
        raw = await xlsxText(input.bytes);
        break;
      default:
        raw = decodeText(input.bytes);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[files] text extraction failed", {
      kind,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    throw new AppError("VALIDATION", "The file could not be read", { reason: "unreadable" });
  }
  return { ...truncateText(normalizeWhitespace(raw), input.maxChars), kind };
}
