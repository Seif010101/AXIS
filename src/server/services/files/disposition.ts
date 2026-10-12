import "server-only";

// RFC 6266 Content-Disposition with an RFC 5987 `filename*` parameter, so Arabic (or any
// non-ASCII) file names survive downloads, plus a plain-ASCII `filename` fallback.

/** Characters RFC 5987 allows unescaped in `attr-char` (encodeURIComponent leaves a few more). */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Removes path separators, control characters and characters Windows forbids, trims dots
 * and spaces, and caps the length. Keeps letters of every script (Arabic included).
 */
export function sanitizeFileName(fileName: string, fallback = "file"): string {
  const cleaned = (fileName.normalize("NFC").split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");
  if (!cleaned) return fallback;
  if (cleaned.length <= 180) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 && cleaned.length - dot <= 11 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 180 - extension.length) + extension;
}

/** An ASCII-only rendering of a file name for old clients (non-ASCII becomes "_"). */
function asciiFallback(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\%;]/g, "_");
  // A name made only of replacement characters is useless; keep at least the extension.
  if (/^[_\s.]*$/.test(ascii.replace(/\.[A-Za-z0-9]{1,10}$/, ""))) {
    const extension = /\.[A-Za-z0-9]{1,10}$/.exec(fileName)?.[0] ?? "";
    return `download${extension}`;
  }
  return ascii;
}

/**
 * A Content-Disposition header value for a download.
 *
 * @example
 * contentDisposition("تقرير الصف.xlsx")
 * // attachment; filename="download.xlsx"; filename*=UTF-8''%D8%AA%D9%82...xlsx
 */
export function contentDisposition(fileName: string, type: "attachment" | "inline" = "attachment"): string {
  const safe = sanitizeFileName(fileName);
  return `${type}; filename="${asciiFallback(safe)}"; filename*=UTF-8''${encodeRfc5987(safe)}`;
}
