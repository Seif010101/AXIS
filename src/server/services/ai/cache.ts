import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, lte, sql } from "drizzle-orm";
import type { z } from "zod";
import { db, schema } from "@/server/db";
import { AppError } from "@/server/errors";

// Cache for deterministic, NON-PERSONAL generated content (e.g. a curriculum book's
// summary, a topic's practice questions shared by every class). The legacy cache keyed chat
// replies on the message text alone and served one user's answer to another: never cache
// chat replies, anything built from a user's own data (names, submissions, grades,
// conversations, uploaded files) or anything that differs per user. When in doubt, don't.
//
// The key is a SHA-256 over the kind and *every* input that shapes the result. Put the
// prompt version, model tier, locale and source content (or its hash) in `keyParts`.

/** A value that can be part of a cache key. Bytes are hashed; objects are key-order independent. */
export type CacheKeyPart =
  | string
  | number
  | boolean
  | null
  | Date
  | Uint8Array
  | readonly CacheKeyPart[]
  | { readonly [key: string]: CacheKeyPart | undefined };

type Encoded = [string, ...unknown[]];

// Every value is encoded with an explicit type tag, so different inputs can't produce the
// same text: "1" vs 1, ["a,b"] vs ["a","b"], {a:1,b:2} vs {b:2,a:1} (same, on purpose).
function encode(value: CacheKeyPart | undefined): Encoded {
  if (value === null || value === undefined) return ["null"];
  if (typeof value === "string") return ["s", value];
  if (typeof value === "boolean") return ["b", value];
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AppError("VALIDATION", "Cache key numbers must be finite");
    return ["n", value];
  }
  if (value instanceof Date) return ["d", value.toISOString()];
  if (value instanceof Uint8Array) return ["bytes", createHash("sha256").update(value).digest("hex")];
  if (Array.isArray(value)) return ["a", ...value.map((item: CacheKeyPart) => encode(item))];
  const record = value as { readonly [key: string]: CacheKeyPart | undefined };
  return [
    "o",
    ...Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => [key, encode(record[key])]),
  ];
}

const KIND_PATTERN = /^[a-z][a-z0-9_.-]{1,49}$/;

/** The 64-character hex key for a kind and its inputs. */
export function cacheKey(kind: string, keyParts: readonly CacheKeyPart[]): string {
  if (!KIND_PATTERN.test(kind)) throw new AppError("VALIDATION", `Invalid cache kind "${kind}"`);
  return createHash("sha256")
    .update(JSON.stringify(["content-cache/v1", kind, encode(keyParts)]))
    .digest("hex");
}

export interface CachedJsonOptions<T> {
  /** What is cached, e.g. "library.summary" (stored as the row's content type, part of the key). */
  kind: string;
  /** Every input that shapes the result. Never user-specific data (see the file comment). */
  keyParts: readonly CacheKeyPart[];
  /** How long a stored result stays valid. */
  ttlSeconds: number;
  /** Computes the value on a miss. Must return plain JSON (no Dates, Maps, undefined). */
  producer: () => Promise<T>;
  /**
   * Validates cached content when it is read back (stored JSON is never trusted blindly);
   * a mismatch, e.g. after the shape changed in a deploy, is treated as a miss.
   */
  schema: z.ZodType<T>;
}

/**
 * Returns the cached JSON value for (kind, keyParts) if it has not expired, otherwise runs
 * `producer`, stores its result and returns it. Producer errors are not cached.
 *
 * @example
 * const summary = await cachedJson({
 *   kind: "library.summary",
 *   keyParts: [book.id, book.updatedAt, "prompt-v2", locale],
 *   ttlSeconds: 30 * 24 * 3600,
 *   schema: summarySchema,
 *   producer: () => generateStructured({ ctx, feature: "library.summary", tier: "smart", schema: summarySchema, prompt }),
 * });
 */
export async function cachedJson<T>(options: CachedJsonOptions<T>): Promise<T> {
  if (!Number.isInteger(options.ttlSeconds) || options.ttlSeconds <= 0) {
    throw new AppError("VALIDATION", "ttlSeconds must be a positive integer");
  }
  const key = cacheKey(options.kind, options.keyParts);
  const now = new Date();
  const cache = schema.contentCache;

  const [hit] = await db
    .select({ id: cache.id, content: cache.content })
    .from(cache)
    .where(and(eq(cache.cacheKey, key), gt(cache.expiresAt, now)))
    .limit(1);
  if (hit) {
    const parsed = options.schema.safeParse(hit.content);
    if (parsed.success) {
      await db
        .update(cache)
        .set({ hitCount: sql`${cache.hitCount} + 1` })
        .where(eq(cache.id, hit.id));
      return parsed.data;
    }
  }

  const value = await options.producer();
  if (value === undefined) throw new AppError("INTERNAL", "Cache producer returned undefined");
  const expiresAt = new Date(Date.now() + options.ttlSeconds * 1000);
  await db
    .insert(cache)
    .values({ cacheKey: key, contentType: options.kind, content: value, expiresAt })
    .onDuplicateKeyUpdate({
      set: { contentType: options.kind, content: value, expiresAt, hitCount: 0, createdAt: new Date() },
    });
  return value;
}

/** Deletes expired cache rows; returns how many were removed. For a periodic cleanup job. */
export async function purgeExpiredCache(now: Date = new Date()): Promise<number> {
  const [result] = await db.delete(schema.contentCache).where(lte(schema.contentCache.expiresAt, now));
  return result.affectedRows;
}
