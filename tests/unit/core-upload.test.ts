import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { jsx } from "react/jsx-runtime";
import { describe, expect, it } from "vitest";
import {
  announcementKey,
  checkFile,
  DEFAULT_UPLOAD_MAX_BYTES,
  FileUpload,
  type FileUploadProps,
} from "@/components/common/file-upload";
import arCommon from "../../messages/ar/common.json";
import deCommon from "../../messages/de/common.json";
import enCommon from "../../messages/en/common.json";
import esCommon from "../../messages/es/common.json";
import frCommon from "../../messages/fr/common.json";
import zhCommon from "../../messages/zh/common.json";

function render(props: FileUploadProps, locale: "ar" | "en" = "en"): string {
  const common = locale === "ar" ? arCommon : enCommon;
  return renderToStaticMarkup(
    jsx(NextIntlClientProvider, { locale, messages: { common }, children: jsx(FileUpload, props) }),
  );
}

const onFile = async () => undefined;

describe("checkFile", () => {
  const MB = 1024 * 1024;

  it("accepts files allowed by extension, MIME type or MIME group", () => {
    expect(checkFile({ name: "Grades.XLSX", type: "", size: 10 }, [".xlsx", ".csv"], MB)).toBeNull();
    expect(
      checkFile({ name: "scan", type: "application/pdf", size: 10 }, ["application/pdf"], MB),
    ).toBeNull();
    expect(checkFile({ name: "photo.heic", type: "image/heic", size: 10 }, ["image/*"], MB)).toBeNull();
    expect(checkFile({ name: "any.bin", type: "", size: 10 }, [], MB)).toBeNull();
  });

  it("refuses empty, oversized and disallowed files", () => {
    expect(checkFile({ name: "a.pdf", type: "application/pdf", size: 0 }, [".pdf"], MB)).toBe("empty");
    expect(checkFile({ name: "a.pdf", type: "application/pdf", size: MB + 1 }, [".pdf"], MB)).toBe(
      "tooLarge",
    );
    expect(checkFile({ name: "a.pdf.exe", type: "", size: 10 }, [".pdf"], MB)).toBe("type");
    expect(checkFile({ name: "a.txt", type: "text/plain", size: 10 }, ["image/*"], MB)).toBe("type");
  });
});

describe("FileUpload", () => {
  it("renders a labelled picker with the allowed types and size limit", () => {
    const html = render({ accept: [".pdf", ".docx"], onFile });
    expect(html).toContain(enCommon.upload.dropzone);
    expect(html).toContain(enCommon.upload.choose);
    expect(html).toMatch(/Allowed types: PDF and DOCX · Up to 8 MB/);
    expect(html).toContain('accept=".pdf,.docx"');
    // The real button is the keyboard target and describes itself with the title and hint.
    expect(html).toMatch(/<button[^>]*type="button"[^>]*aria-describedby="[^"]+ [^"]+"/);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*tabindex="-1"[^>]*aria-hidden="true"/);
    expect(html).toContain('role="status"');
    expect(DEFAULT_UPLOAD_MAX_BYTES).toBe(8 * 1024 * 1024);
  });

  it("translates every text and uses only RTL-safe layout classes", () => {
    const html = render(
      { accept: [".xlsx"], maxBytes: 2 * 1024 * 1024, getUploadUrl: async () => ({ url: "" }) },
      "ar",
    );
    expect(html).toContain(arCommon.upload.dropzone);
    expect(html).toContain(arCommon.upload.choose);
    expect(html).not.toMatch(/\b(ml|mr|pl|pr|left|right)-[\d[]|\btext-(left|right)\b/);
  });

  it("announces only changes of state to screen readers, never each progress tick", () => {
    expect(announcementKey("idle")).toBeNull();
    expect(announcementKey("invalid")).toBeNull(); // errors use role="alert"
    expect(announcementKey("failed")).toBeNull();
    expect(announcementKey("uploading")).toBe("started");
    expect(announcementKey("processing")).toBe("processing");
    expect(announcementKey("done")).toBe("done");
    // While uploading, the live region's text has no percentage in any locale, so it stays
    // the same through every progress event and is announced once.
    for (const common of [arCommon, enCommon, zhCommon, deCommon, esCommon, frCommon]) {
      expect(common.upload.started).not.toMatch(/[{%٪]/);
      expect(common.upload.started).not.toBe(common.upload.uploading);
    }
    // Before a file is picked the live region is present and silent.
    expect(render({ onFile })).toContain('<p role="status" aria-live="polite" class="sr-only"></p>');
  });

  it("can be disabled and given a custom title", () => {
    const html = render({ onFile, disabled: true, label: "Import students" });
    expect(html).toContain("Import students");
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Up to 8 MB");
  });
});
