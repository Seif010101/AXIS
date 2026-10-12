import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/env";
import { AppError } from "@/server/errors";
import { contentDisposition } from "@/server/services/files/disposition";

// File storage on Backblaze B2 through its S3-compatible API. Large files (curriculum
// books) never pass through our server: the browser PUTs them to a presigned URL and
// downloads them from a short-lived presigned URL. Object keys are stored in the database;
// URLs are generated per request and never stored.

/** Largest object a presigned upload may create (B2 single-PUT limit is 5 GB). */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]{0,499}$/;
const PREFIX_PATTERN = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/;
const CONTENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;

interface StorageConfig {
  bucket: string;
  client: S3Client;
}

let cached: { signature: string; config: StorageConfig } | undefined;

/** True when all B2 settings are present. Features can hide uploads instead of failing. */
export function isStorageConfigured(): boolean {
  return Boolean(env.B2_KEY_ID && env.B2_APP_KEY && env.B2_BUCKET && env.B2_ENDPOINT);
}

/** B2 endpoints look like https://s3.<region>.backblazeb2.com. */
function regionFromEndpoint(endpoint: string): string | undefined {
  return /^https?:\/\/s3\.([a-z0-9-]+)\.backblazeb2\.com/i.exec(endpoint)?.[1];
}

function storage(): StorageConfig {
  const { B2_KEY_ID: keyId, B2_APP_KEY: appKey, B2_BUCKET: bucket, B2_ENDPOINT: endpoint } = env;
  if (!keyId || !appKey || !bucket || !endpoint) {
    throw new AppError("STORAGE_NOT_CONFIGURED", "B2 storage settings are missing");
  }
  const region = env.B2_REGION ?? regionFromEndpoint(endpoint) ?? "us-east-1";
  const signature = [keyId, appKey, bucket, endpoint, region].join("\n");
  if (cached?.signature !== signature) {
    const client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: keyId, secretAccessKey: appKey },
      // B2 rejects the CRC checksums the SDK adds by default.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    cached = { signature, config: { bucket, client } };
  }
  return cached.config;
}

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes("..") || key.includes("//")) {
    throw new AppError("VALIDATION", "Invalid storage key");
  }
}

function assertExpiry(seconds: number): void {
  if (!Number.isInteger(seconds) || seconds < 30 || seconds > 3600) {
    throw new AppError("VALIDATION", "expiresIn must be 30-3600 seconds");
  }
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.name === "NoSuchKey" || error.name === "NotFound" || error.$metadata.httpStatusCode === 404)
  );
}

/** Logs a storage failure and hides its details from the client. */
function storageFailure(operation: string, key: string, error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isNotFound(error)) return new AppError("NOT_FOUND", "File not found");
  console.error(`[storage] ${operation} failed`, {
    key,
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
  return new AppError("INTERNAL", "Storage request failed");
}

/**
 * A new, unguessable object key under `prefix`: `<prefix>/<uuid>[-<ascii-slug>].<ext>`.
 * The original name is kept only as an ASCII hint (store the real name in your table).
 *
 * @example objectKey("books", "كتاب العلوم - Grade 5.pdf") // "books/2f1c…-grade-5.pdf"
 */
export function objectKey(prefix: string, fileName: string): string {
  const cleanPrefix = prefix
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  if (!PREFIX_PATTERN.test(cleanPrefix)) throw new AppError("VALIDATION", "Invalid storage prefix");
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const rawExtension = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  const extension = /^[a-z0-9]{1,10}$/.test(rawExtension) ? `.${rawExtension}` : "";
  const slug = (dot > 0 ? base.slice(0, dot) : base)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${cleanPrefix}/${crypto.randomUUID()}${slug ? `-${slug}` : ""}${extension}`;
}

/** What the browser needs to upload a file directly to storage. */
export interface UploadTarget {
  url: string;
  method: "PUT";
  /** Send exactly these headers with the PUT (they are part of the signature). */
  headers: { "Content-Type": string };
  expiresAt: string;
}

/**
 * A presigned PUT URL for one object. Content type and length are signed, so the browser
 * can only upload a file of exactly that type and size. After the upload, call statObject()
 * before recording the file. Throws STORAGE_NOT_CONFIGURED or VALIDATION.
 *
 * @example
 * const key = objectKey("books", file.name);
 * const target = await createUploadUrl({ key, contentType: "application/pdf", contentLength: file.size });
 */
export async function createUploadUrl(input: {
  key: string;
  contentType: string;
  contentLength: number;
  /** Seconds the URL stays valid (30-3600, default 900). */
  expiresIn?: number;
  /** Upper bound for contentLength (default MAX_UPLOAD_BYTES). */
  maxBytes?: number;
}): Promise<UploadTarget> {
  const { bucket, client } = storage();
  const expiresIn = input.expiresIn ?? 900;
  assertKey(input.key);
  assertExpiry(expiresIn);
  const maxBytes = Math.min(input.maxBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);
  if (!Number.isInteger(input.contentLength) || input.contentLength <= 0 || input.contentLength > maxBytes) {
    throw new AppError("VALIDATION", "Invalid file size", { maxBytes });
  }
  if (!CONTENT_TYPE_PATTERN.test(input.contentType)) throw new AppError("VALIDATION", "Invalid content type");
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });
  try {
    const url = await getSignedUrl(client, command, {
      expiresIn,
      signableHeaders: new Set(["content-type", "content-length"]),
    });
    return {
      url,
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  } catch (error) {
    throw storageFailure("presign upload", input.key, error);
  }
}

/**
 * A short-lived download URL. The browser saves the file as `fileName` (Arabic names are
 * kept, RFC 5987). Use `disposition: "inline"` to open PDFs/images in the browser.
 */
export async function createDownloadUrl(input: {
  key: string;
  fileName: string;
  /** Seconds the URL stays valid (30-3600, default 300). */
  expiresIn?: number;
  disposition?: "attachment" | "inline";
  /** Overrides the stored Content-Type in the response. */
  contentType?: string;
}): Promise<string> {
  const { bucket, client } = storage();
  const expiresIn = input.expiresIn ?? 300;
  assertKey(input.key);
  assertExpiry(expiresIn);
  if (input.contentType !== undefined && !CONTENT_TYPE_PATTERN.test(input.contentType)) {
    throw new AppError("VALIDATION", "Invalid content type");
  }
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ResponseContentDisposition: contentDisposition(input.fileName, input.disposition ?? "attachment"),
    ResponseContentType: input.contentType,
  });
  try {
    return await getSignedUrl(client, command, { expiresIn });
  } catch (error) {
    throw storageFailure("presign download", input.key, error);
  }
}

/** Size and type of a stored object, or null when it does not exist. */
export async function statObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
  const { bucket, client } = storage();
  assertKey(key);
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: head.ContentLength ?? 0, contentType: head.ContentType ?? null };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw storageFailure("stat", key, error);
  }
}

/**
 * Reads a whole object into memory, refusing objects larger than `maxBytes` (checked
 * before and while downloading). Throws NOT_FOUND, VALIDATION (too large) or INTERNAL.
 */
export async function readObject(key: string, maxBytes: number): Promise<Uint8Array> {
  const { bucket, client } = storage();
  assertKey(key);
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) throw new AppError("NOT_FOUND", "File not found");
    const body = result.Body.transformToWebStream();
    if ((result.ContentLength ?? 0) > maxBytes) {
      await body.cancel(); // close the connection instead of leaving the body unread
      throw new AppError("VALIDATION", "File is too large", { maxBytes });
    }
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new AppError("VALIDATION", "File is too large", { maxBytes });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    throw storageFailure("read", key, error);
  }
}

/** Deletes an object. Deleting a missing object is not an error. */
export async function deleteObject(key: string): Promise<void> {
  const { bucket, client } = storage();
  assertKey(key);
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (isNotFound(error)) return;
    throw storageFailure("delete", key, error);
  }
}
