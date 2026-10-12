import { afterEach, describe, expect, it, vi } from "vitest";

// The storage service reads its settings from env (parsed at import), so set them first.
vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "mysql://root@127.0.0.1:3306/unused",
    BETTER_AUTH_SECRET: "unit-test-secret-unit-test-secret-unit-test",
    BETTER_AUTH_URL: "http://localhost:3000",
    ALLOWED_EMAIL_DOMAIN: "school.test",
    PROXY_TICKET_SECRET: "unit-test-proxy-secret-unit-test-proxy-secret",
    B2_KEY_ID: "test-key-id",
    B2_APP_KEY: "test-app-key",
    B2_BUCKET: "axis-test-bucket",
    B2_ENDPOINT: "https://s3.eu-central-003.backblazeb2.com",
  });
});

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "@/env";
import { AppError } from "@/server/errors";
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  isStorageConfigured,
  objectKey,
  readObject,
  statObject,
} from "@/server/services/storage";

function bodyOf(chunks: Uint8Array[]) {
  return {
    transformToWebStream: () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      }),
  };
}

/** Replaces S3Client.send (no network). Returns the spy to inspect the commands. */
function mockSend(handler: (command: unknown) => unknown) {
  return vi
    .spyOn(S3Client.prototype, "send")
    .mockImplementation(async (command: unknown) => handler(command) as never);
}

async function caught(promise: Promise<unknown>): Promise<AppError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storage configuration", () => {
  it("is configured from the B2 settings and fails clearly without them", async () => {
    expect(isStorageConfigured()).toBe(true);
    const saved = env.B2_BUCKET;
    env.B2_BUCKET = undefined;
    try {
      expect(isStorageConfigured()).toBe(false);
      const error = await caught(createDownloadUrl({ key: "books/a.pdf", fileName: "a.pdf" }));
      expect(error.code).toBe("STORAGE_NOT_CONFIGURED");
      expect((await caught(readObject("books/a.pdf", 10))).code).toBe("STORAGE_NOT_CONFIGURED");
    } finally {
      env.B2_BUCKET = saved;
    }
  });
});

describe("objectKey", () => {
  it("builds unique, sanitized keys under the prefix", () => {
    const a = objectKey("books", "كتاب العلوم - Grade 5.PDF");
    const b = objectKey("books", "كتاب العلوم - Grade 5.PDF");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^books\/[0-9a-f-]{36}-grade-5\.pdf$/);
    expect(objectKey("chat/attachments", "صورة.png")).toMatch(/^chat\/attachments\/[0-9a-f-]{36}\.png$/);
    expect(objectKey("books", "../../etc/passwd")).toMatch(/^books\/[0-9a-f-]{36}-passwd$/);
    expect(objectKey("books", "noext.exe;rm -rf")).not.toContain(";");
  });

  it("rejects unsafe prefixes", () => {
    expect(() => objectKey("../secrets", "a.pdf")).toThrow(AppError);
    expect(() => objectKey("Books Folder", "a.pdf")).toThrow(AppError);
    expect(() => objectKey("", "a.pdf")).toThrow(AppError);
  });
});

describe("presigned URLs", () => {
  it("signs uploads with the content type and exact length, without CRC checksums", async () => {
    const target = await createUploadUrl({
      key: "books/0b5c-test.pdf",
      contentType: "application/pdf",
      contentLength: 1234,
      expiresIn: 600,
    });
    const url = new URL(target.url);
    expect(url.host).toBe("axis-test-bucket.s3.eu-central-003.backblazeb2.com");
    expect(url.pathname).toBe("/books/0b5c-test.pdf");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
      expect.arrayContaining(["content-length", "content-type", "host"]),
    );
    expect(url.searchParams.get("X-Amz-Credential")).toContain("test-key-id/");
    expect(url.searchParams.get("X-Amz-Credential")).toContain("/eu-central-003/s3/");
    expect(target.url).not.toMatch(/checksum/i);
    expect(target).toMatchObject({ method: "PUT", headers: { "Content-Type": "application/pdf" } });
  });

  it("validates upload parameters", async () => {
    const base = { key: "books/a.pdf", contentType: "application/pdf", contentLength: 10 };
    expect((await caught(createUploadUrl({ ...base, contentLength: 0 }))).code).toBe("VALIDATION");
    expect((await caught(createUploadUrl({ ...base, contentLength: 11, maxBytes: 10 }))).code).toBe(
      "VALIDATION",
    );
    expect((await caught(createUploadUrl({ ...base, contentType: "pdf" }))).code).toBe("VALIDATION");
    expect((await caught(createUploadUrl({ ...base, key: "../a.pdf" }))).code).toBe("VALIDATION");
    expect((await caught(createUploadUrl({ ...base, key: "/books/a.pdf" }))).code).toBe("VALIDATION");
    expect((await caught(createUploadUrl({ ...base, expiresIn: 86_400 }))).code).toBe("VALIDATION");
  });

  it("signs downloads with an RFC 5987 file name", async () => {
    const url = new URL(await createDownloadUrl({ key: "books/a.pdf", fileName: "كتاب العلوم.pdf" }));
    const disposition = url.searchParams.get("response-content-disposition") ?? "";
    expect(disposition).toContain('attachment; filename="download.pdf"');
    expect(disposition).toContain("filename*=UTF-8''%D9%83%D8%AA%D8%A7%D8%A8%20");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");

    const inline = new URL(
      await createDownloadUrl({
        key: "books/a.pdf",
        fileName: "a.pdf",
        disposition: "inline",
        expiresIn: 60,
      }),
    );
    expect(inline.searchParams.get("response-content-disposition")).toMatch(/^inline;/);
  });
});

describe("object operations", () => {
  it("reads an object within the size limit", async () => {
    const send = mockSend(() => ({
      ContentLength: 6,
      Body: bodyOf([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])]),
    }));
    const bytes = await readObject("books/a.pdf", 10);
    expect([...bytes]).toEqual([1, 2, 3, 4, 5, 6]);
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect((command as GetObjectCommand).input).toEqual({ Bucket: "axis-test-bucket", Key: "books/a.pdf" });
  });

  it("refuses objects over the limit, even when the declared length lies", async () => {
    mockSend(() => ({ ContentLength: 100, Body: bodyOf([new Uint8Array(100)]) }));
    expect((await caught(readObject("books/a.pdf", 10))).code).toBe("VALIDATION");
    mockSend(() => ({ ContentLength: 2, Body: bodyOf([new Uint8Array(8), new Uint8Array(8)]) }));
    expect((await caught(readObject("books/a.pdf", 10))).code).toBe("VALIDATION");
  });

  it("maps missing objects to NOT_FOUND and hides other failures", async () => {
    mockSend(() => {
      throw new NoSuchKey({
        message: "The specified key does not exist.",
        $metadata: { httpStatusCode: 404 },
      });
    });
    expect((await caught(readObject("books/missing.pdf", 10))).code).toBe("NOT_FOUND");
    expect(await statObject("books/missing.pdf")).toBeNull();
    await expect(deleteObject("books/missing.pdf")).resolves.toBeUndefined();

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSend(() => {
      throw new Error("socket hang up: secret-endpoint");
    });
    const error = await caught(readObject("books/a.pdf", 10));
    expect(error.code).toBe("INTERNAL");
    expect(error.message).not.toContain("secret");
  });

  it("stats and deletes objects", async () => {
    const send = mockSend((command) =>
      command instanceof HeadObjectCommand ? { ContentLength: 42, ContentType: "application/pdf" } : {},
    );
    expect(await statObject("books/a.pdf")).toEqual({ size: 42, contentType: "application/pdf" });
    await deleteObject("books/a.pdf");
    expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
    expect((await caught(deleteObject("books/../x"))).code).toBe("VALIDATION");
  });
});
