import "server-only";
import type { Role } from "@/server/policy/roles";

/** What a quota counts: text calls (generate/stream) or image generations. */
export type AiQuotaKind = "text" | "image";

/**
 * Daily AI calls per user, by role. `null` means unlimited.
 *
 * A "day" is the schools' local day (`APP_TIME_ZONE`). Every model call counts once,
 * whatever its size; the token totals are recorded separately for the cost report.
 * Edit these numbers to change the quotas; nothing else needs to change.
 */
export const AI_DAILY_LIMITS = {
  student: { text: 150, image: 10 },
  teacher: { text: 400, image: 40 },
  admin: { text: 200, image: 20 },
  manager: { text: 300, image: 20 },
  owner: { text: null, image: null },
} as const satisfies Record<Role, Record<AiQuotaKind, number | null>>;

/** The daily limit for a role and kind, or null when unlimited. */
export function dailyLimit(role: Role, kind: AiQuotaKind): number | null {
  return AI_DAILY_LIMITS[role][kind];
}

/** Default cap on generated tokens per call, so one request can't run up the bill. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

/** File types that may be sent inline to the model (generate* `files`, chat attachments). */
export const INLINE_FILE_MEDIA_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

/** Total size of the inline files of one call (the provider rejects bigger requests). */
export const INLINE_FILES_MAX_BYTES = 18 * 1024 * 1024;

/** Limits applied to chat history coming from a client (see streamChat). */
export const CHAT_LIMITS = {
  /** Only the most recent messages are sent to the model. */
  maxMessages: 40,
  /** Total characters of text across the messages that are sent. */
  maxTextChars: 120_000,
  /** Inline attachments (data: URLs) per request. */
  maxFiles: 4,
  /** Decoded size of one inline attachment. */
  maxFileBytes: 8 * 1024 * 1024,
} as const;
