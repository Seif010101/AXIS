import "server-only";
import JSZip from "jszip";
import { AppError } from "@/server/errors";

/** Upper bound for the decompressed size of an Office file (zip bomb guard). */
export const MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024;

async function entrySize(entry: JSZip.JSZipObject, budget: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let size = 0;
    const stream = entry.nodeStream("nodebuffer");
    stream
      .on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > budget) {
          stream.pause();
          stream.removeAllListeners("data");
          reject(
            new AppError("VALIDATION", "The file is too large once decompressed", { reason: "too_large" }),
          );
        }
      })
      .on("error", reject)
      .on("end", () => resolve(size));
  });
}

/**
 * Opens a zip container (docx/pptx/xlsx) after checking that its entries really
 * decompress to at most `maxUncompressed` bytes in total. JSZip verifies sizes while
 * inflating, so a forged header can't slip past the count.
 */
export async function loadZipSafely(
  bytes: Uint8Array,
  maxUncompressed: number = MAX_UNCOMPRESSED_BYTES,
): Promise<JSZip> {
  const zip = await JSZip.loadAsync(bytes);
  let total = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    total += await entrySize(entry, maxUncompressed - total);
  }
  return zip;
}
