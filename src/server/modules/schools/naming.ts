// Pure text helpers for the schools area (no database, unit-tested).

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;
const ARABIC_DIACRITICS = /[ً-ٰٟ]/g;
const TATWEEL = /ـ/g;
const EASTERN_DIGITS = /[٠-٩۰-۹]/g;

/** Normalizes user input for storage: NFKC, no control characters, single spaces, trimmed. */
export function clean(value: string): string {
  return value.normalize("NFKC").replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
}

/** Like clean() but returns null for an empty result (optional text columns). */
export function cleanOrNull(value: string | null | undefined): string | null {
  const cleaned = clean(value ?? "");
  return cleaned === "" ? null : cleaned;
}

/**
 * A comparison key: case-, diacritic- and spelling-variant-insensitive. Used to match class
 * names, role words and duplicates. Never stored.
 */
export function foldKey(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(EASTERN_DIGITS, (digit) => String((digit.charCodeAt(0) & 0xf) % 10))
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

/** The ASCII slug of a ministry ID used in generated emails ("A-12/3" → "a123"). */
export function idSlug(ministryId: string | null | undefined): string {
  return foldKey(ministryId ?? "").replace(/[^a-z0-9]/g, "");
}

export type AccountRole = "manager" | "admin" | "teacher" | "student";

/**
 * Candidate local parts for a new account's email, in order of preference.
 * With a ministry ID: `<prefix><id>`, then `<prefix><id>.2`, `.3`, …
 * Without: `<prefix>.<role><n>` for n = start, start+1, …
 */
export function emailCandidates(
  prefix: string,
  role: AccountRole,
  ministryId: string | null | undefined,
  start = 1,
  count = 50,
): string[] {
  const slug = idSlug(ministryId);
  const base = prefix.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
  if (slug) {
    const local = `${base}${slug}`.slice(0, 60);
    return [local, ...Array.from({ length: count - 1 }, (_, i) => `${local}.${i + 2}`)];
  }
  return Array.from({ length: count }, (_, i) => `${base}.${role}${start + i}`);
}

/** Splits "A, B، C" / newline lists into clean unique entries (Arabic comma included). */
export function splitList(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(/[,،;\n\r]+/)) {
    const cleaned = clean(part);
    const key = foldKey(cleaned);
    if (cleaned && !seen.has(key)) {
      seen.add(key);
      out.push(cleaned);
    }
  }
  return out;
}

/** Escapes a value for use inside a SQL LIKE pattern (the default `\` escape). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Natural sort for grades/sections ("2" < "10", "A" < "B"). */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
