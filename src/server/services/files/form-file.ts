import "server-only";
import { AppError } from "@/server/errors";
import { sanitizeFileName } from "./disposition";

/** Default size limit of a file posted to a server action (next.config allows 10 MB bodies). */
export const FORM_FILE_MAX_BYTES = 8 * 1024 * 1024;

/** A file read from FormData, ready for extractText()/readSheet(). */
export interface UploadedFile {
  /** Sanitized original name (safe to display and to store). */
  fileName: string;
  /** Lowercased MIME type reported by the browser (may be empty). */
  mimeType: string;
  size: number;
  bytes: Uint8Array;
}

type Signature = "pdf" | "zip" | "png" | "jpeg" | "gif" | "webp";

/** Formats whose bytes must start with a known signature (the extension alone can lie). */
const EXPECTED_SIGNATURE: Record<string, Signature> = {
  pdf: "pdf",
  docx: "zip",
  pptx: "zip",
  xlsx: "zip",
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  gif: "gif",
  webp: "webp",
};

function startsWith(bytes: Uint8Array, prefix: readonly number[], offset = 0): boolean {
  return prefix.every((byte, index) => bytes[offset + index] === byte);
}

function signatureOf(bytes: Uint8Array): Signature | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif"; // GIF8
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return "webp";
  return null;
}

/** True when `accept` (extensions like ".pdf", MIME types like "image/png" or "image/*") allows the file. */
export function isAccepted(fileName: string, mimeType: string, accept: readonly string[]): boolean {
  if (accept.length === 0) return true;
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();
  return accept.some((rule) => {
    const entry = rule.trim().toLowerCase();
    if (entry.startsWith(".")) return name.endsWith(entry);
    if (entry.endsWith("/*")) return mime.startsWith(entry.slice(0, -1));
    return mime === entry;
  });
}

function invalid(field: string, reason: string, extra: Record<string, unknown> = {}): AppError {
  return new AppError("VALIDATION", `Invalid file in "${field}"`, { field, reason, ...extra });
}

/**
 * Reads one uploaded file from a server action's FormData, enforcing size and type limits
 * and checking that PDFs, Office files and images really are what their extension says.
 * Throws VALIDATION with `details.reason`: "missing", "empty", "too_large", "type".
 *
 * @example
 * export const importPeopleAction = action({ area: "admin", input: z.instanceof(FormData) }, async (form, ctx) => {
 *   const file = await readFormFile(form, "file", { accept: [".xlsx", ".csv"] });
 *   const sheet = await readSheet(file.bytes, { fileName: file.fileName, aliases });
 *   …
 * });
 */
export async function readFormFile(
  formData: FormData,
  field: string,
  options: { maxBytes?: number; accept?: readonly string[] } = {},
): Promise<UploadedFile> {
  const maxBytes = options.maxBytes ?? FORM_FILE_MAX_BYTES;
  const entries = formData.getAll(field);
  if (entries.length !== 1 || !(entries[0] instanceof File)) throw invalid(field, "missing");
  const file = entries[0];
  if (file.size === 0) throw invalid(field, "empty");
  if (file.size > maxBytes) throw invalid(field, "too_large", { maxBytes });

  const fileName = sanitizeFileName(file.name);
  const mimeType = (file.type || "").toLowerCase();
  if (!isAccepted(fileName, mimeType, options.accept ?? [])) throw invalid(field, "type");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw invalid(field, "too_large", { maxBytes });
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? "";
  const expected = EXPECTED_SIGNATURE[extension];
  if (expected && signatureOf(bytes) !== expected) throw invalid(field, "type");

  return { fileName, mimeType, size: bytes.byteLength, bytes };
}
