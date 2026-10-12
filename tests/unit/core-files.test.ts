import ExcelJS from "exceljs";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/errors";
import {
  buildWorkbook,
  contentDisposition,
  extractText,
  normalizeHeader,
  readFormFile,
  readSheet,
  toCsv,
  truncateText,
} from "@/server/services/files";
import { loadZipSafely } from "@/server/services/files/zip";

// Fixture files are generated here (no binary fixtures in the repo, no network).

const encoder = new TextEncoder();

async function zipOf(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

function docx(paragraphs: string[]) {
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`)
    .join("");
  return zipOf({
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  });
}

function slide(lines: string[]) {
  const paragraphs = lines
    .map((line) => `<a:p><a:r><a:rPr lang="en-US"/><a:t>${line}</a:t></a:r></a:p>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
}

/** Two slides whose presentation order (slide2 first) differs from their file numbers. */
function pptx() {
  return zipOf({
    "ppt/presentation.xml":
      '<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>',
    "ppt/_rels/presentation.xml.rels":
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="slide" Target="slides/slide2.xml"/></Relationships>',
    "ppt/slides/slide1.xml": slide(["Second slide", "Fish &amp; chips &#1605;"]),
    "ppt/slides/slide2.xml": slide(["First slide", "الدرس الأول"]),
  });
}

/** A minimal valid one-page PDF showing `text`, with a correct xref table. */
function pdf(text: string): Uint8Array {
  const stream = `BT /F1 18 Tf 20 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(out);
}

async function xlsx(rows: (string | number | null)[][], name = "Sheet1"): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(name);
  for (const row of rows) sheet.addRow(row);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
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

describe("extractText", () => {
  it("reads Word documents", async () => {
    const result = await extractText({
      bytes: await docx(["مرحبا بالعالم", "Second paragraph"]),
      fileName: "lesson.docx",
      maxChars: 1000,
    });
    expect(result.kind).toBe("docx");
    expect(result.text).toBe("مرحبا بالعالم\n\nSecond paragraph");
    expect(result.truncated).toBe(false);
  });

  it("reads PowerPoint slides in presentation order and decodes XML entities", async () => {
    const result = await extractText({ bytes: await pptx(), fileName: "deck.PPTX", maxChars: 1000 });
    expect(result.text).toBe("First slide\nالدرس الأول\n\nSecond slide\nFish & chips م");
  });

  it("reads Excel workbooks sheet by sheet", async () => {
    const result = await extractText({
      bytes: await xlsx(
        [
          ["Name", "Score"],
          ["Ali", 9],
        ],
        "Marks",
      ),
      fileName: "marks.xlsx",
      maxChars: 1000,
    });
    expect(result.text).toBe("# Marks\nName\tScore\nAli\t9");
  });

  it("reads PDFs", async () => {
    const result = await extractText({ bytes: pdf("Hello PDF world"), fileName: "book.pdf", maxChars: 1000 });
    expect(result.kind).toBe("pdf");
    expect(result.text).toContain("Hello PDF world");
  });

  it("reads text, CSV and Markdown (UTF-8 BOM and UTF-16)", async () => {
    const utf8 = await extractText({
      bytes: encoder.encode("﻿سطر أول\r\n\r\n\r\n\r\nline two  \n"),
      fileName: "notes.txt",
      maxChars: 100,
    });
    expect(utf8.text).toBe("سطر أول\n\nline two");
    const utf16 = new Uint8Array([
      0xff,
      0xfe,
      ...new Uint8Array(new Uint16Array([0x0645, 0x0631, 0x062d]).buffer),
    ]);
    expect((await extractText({ bytes: utf16, fileName: "a.csv", maxChars: 100 })).text).toBe("مرح");
    expect(
      (
        await extractText({
          bytes: encoder.encode("# Title"),
          fileName: "upload",
          mimeType: "text/markdown",
          maxChars: 10,
        })
      ).kind,
    ).toBe("md");
  });

  it("truncates without splitting characters", async () => {
    const result = await extractText({ bytes: encoder.encode("ab😀cd"), fileName: "a.txt", maxChars: 3 });
    expect(result).toMatchObject({ text: "ab", truncated: true });
    expect(truncateText("abc", 3)).toEqual({ text: "abc", truncated: false });
  });

  it("rejects unsupported and unreadable files with VALIDATION", async () => {
    const unsupported = await caught(
      extractText({ bytes: new Uint8Array(4), fileName: "old.doc", maxChars: 10 }),
    );
    expect(unsupported).toMatchObject({ code: "VALIDATION", details: { reason: "unsupported_type" } });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = await caught(
      extractText({ bytes: encoder.encode("not a zip"), fileName: "x.docx", maxChars: 10 }),
    );
    expect(broken).toMatchObject({ code: "VALIDATION", details: { reason: "unreadable" } });
  });

  it("refuses zip bombs", async () => {
    const bomb = await zipOf({ "word/document.xml": "0".repeat(2 * 1024 * 1024) });
    expect(bomb.byteLength).toBeLessThan(50_000);
    const error = await caught(loadZipSafely(bomb, 1024 * 1024));
    expect(error.details).toMatchObject({ reason: "too_large" });
    await expect(loadZipSafely(bomb, 3 * 1024 * 1024)).resolves.toBeInstanceOf(JSZip);
  });
});

describe("readSheet", () => {
  const aliases = { name: ["Full name", "الاسم الكامل"], grade: ["grade", "الصف"] };

  it("normalizes Arabic and English headers and maps aliases", async () => {
    const bytes = await xlsx([
      [null],
      ["الاسمُ الكامل:", " الصّف ", "Extra   Column"],
      ["سارة", 5, "x"],
      [null, null, null],
      ["Omar", "6", null],
    ]);
    const sheet = await readSheet(bytes, { aliases });
    expect(sheet.headers).toEqual(["name", "grade", "extra column"]);
    expect(sheet.rows).toEqual([
      { name: "سارة", grade: "5", "extra column": "x" },
      { name: "Omar", grade: "6", "extra column": "" },
    ]);
    expect(sheet.rowNumbers).toEqual([3, 5]);
    expect(normalizeHeader("أَسْماء الطلبة")).toBe(normalizeHeader("اسماء الطلبه"));
  });

  it("reads CSV files (BOM, semicolons, quotes)", async () => {
    const csv = encoder.encode('﻿Full name;الصف\r\n"Doe; Jane";"4"\r\n"Said ""Sam""";5\r\n');
    const sheet = await readSheet(csv, { aliases, fileName: "people.csv" });
    expect(sheet.rows).toEqual([
      { name: "Doe; Jane", grade: "4" },
      { name: 'Said "Sam"', grade: "5" },
    ]);
  });

  it("enforces limits and rejects ambiguous headers", async () => {
    const many = await xlsx([["name"], ["a"], ["b"], ["c"]]);
    expect((await caught(readSheet(many, { maxRows: 2 }))).details).toMatchObject({
      reason: "too_many_rows",
    });
    expect((await caught(readSheet(many, { maxBytes: 10 }))).details).toMatchObject({ reason: "too_large" });
    const duplicate = await xlsx([
      ["Grade", "الصف"],
      ["1", "2"],
    ]);
    expect((await caught(readSheet(duplicate, { aliases }))).details).toMatchObject({
      reason: "duplicate_header",
    });
    const empty = await xlsx([[null]]);
    expect((await caught(readSheet(empty))).details).toMatchObject({ reason: "no_header" });
    expect((await caught(readSheet(encoder.encode("garbage")))).details).toMatchObject({
      reason: "unreadable",
    });
  });
});

describe("buildWorkbook", () => {
  it("writes RTL sheets with a bold header and keeps formula-like text as text", async () => {
    const buffer = await buildWorkbook([
      {
        name: "Report: a/b?",
        rtl: true,
        columns: [
          { key: "name", header: "الاسم" },
          { key: "note", header: "ملاحظة", width: 30 },
        ],
        rows: [
          { name: "سارة", note: "=1+1" },
          { name: "Omar", note: null },
        ],
      },
      { name: "Report: a/b?", columns: [{ key: "n", header: "N" }], rows: [{ n: 3 }] },
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    );
    const [first, second] = workbook.worksheets;
    expect(first.name).toBe("Report  a b");
    expect(second.name).toBe("Report  a b 2");
    expect(first.views[0]).toMatchObject({ rightToLeft: true, state: "frozen", ySplit: 1 });
    expect(second.views[0]).toMatchObject({ rightToLeft: false });
    expect(first.getRow(1).getCell(1).value).toBe("الاسم");
    expect(first.getRow(1).font?.bold).toBe(true);
    expect(first.getCell("B2").type).toBe(ExcelJS.ValueType.String);
    expect(first.getCell("B2").value).toBe("=1+1");
    expect(second.getCell("A2").value).toBe(3);
  });
});

describe("toCsv", () => {
  it("adds exactly one BOM, quotes per RFC 4180 and neutralizes formulas", () => {
    const csv = toCsv([
      ["الاسم", "note"],
      ["﻿سارة", 'He said "hi", twice'],
      ['=HYPERLINK("x")', -5],
      ["@cmd", new Date("2026-01-02T00:00:00Z")],
      [null, true],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.indexOf("﻿", 1)).toBe(-1);
    expect(csv.split("\r\n")).toEqual([
      "﻿الاسم,note",
      'سارة,"He said ""hi"", twice"',
      '"\'=HYPERLINK(""x"")",-5',
      "'@cmd,2026-01-02",
      ",true",
      "",
    ]);
  });
});

describe("contentDisposition", () => {
  it("encodes non-ASCII names per RFC 5987 with an ASCII fallback", () => {
    expect(contentDisposition("تقرير.xlsx")).toBe(
      "attachment; filename=\"download.xlsx\"; filename*=UTF-8''%D8%AA%D9%82%D8%B1%D9%8A%D8%B1.xlsx",
    );
    expect(contentDisposition("Grades (Q1)*.pdf", "inline")).toBe(
      "inline; filename=\"Grades (Q1)_.pdf\"; filename*=UTF-8''Grades%20%28Q1%29_.pdf",
    );
  });

  it("cannot be used for header injection or path traversal", () => {
    const value = contentDisposition('../../a"\r\nSet-Cookie: x=1;.pdf');
    expect(value).not.toMatch(/[\r\n]/);
    expect(value).not.toContain("..");
    expect(value.match(/"/g)).toHaveLength(2);
  });
});

describe("readFormFile", () => {
  function form(...files: File[]) {
    const data = new FormData();
    for (const file of files) data.append("file", file);
    return data;
  }

  it("returns the sanitized name, type, size and bytes", async () => {
    const file = await readFormFile(
      form(new File([pdf("x")], "../ملف.pdf", { type: "application/pdf" })),
      "file",
      {
        accept: [".pdf"],
      },
    );
    expect(file).toMatchObject({ fileName: "ملف.pdf", mimeType: "application/pdf" });
    expect(file.size).toBe(file.bytes.byteLength);
  });

  it("enforces presence, size, type and real content", async () => {
    const reason = async (data: FormData, options?: Parameters<typeof readFormFile>[2]) =>
      (await caught(readFormFile(data, "file", options))).details;

    expect(await reason(new FormData())).toMatchObject({ reason: "missing" });
    expect(await reason(form(new File(["a"], "a.txt"), new File(["b"], "b.txt")))).toMatchObject({
      reason: "missing",
    });
    expect(await reason(form(new File([], "a.txt")))).toMatchObject({ reason: "empty" });
    expect(await reason(form(new File(["12345"], "a.txt")), { maxBytes: 4 })).toMatchObject({
      reason: "too_large",
      maxBytes: 4,
    });
    expect(await reason(form(new File(["x"], "a.exe")), { accept: [".pdf", "image/*"] })).toMatchObject({
      reason: "type",
    });
    // Renamed executable: the extension says PDF, the bytes don't.
    expect(await reason(form(new File(["MZ...."], "a.pdf", { type: "application/pdf" })))).toMatchObject({
      reason: "type",
    });
    const image = await readFormFile(
      form(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1])], "p.png", { type: "image/png" })),
      "file",
      { accept: ["image/*"] },
    );
    expect(image.mimeType).toBe("image/png");
  });
});
