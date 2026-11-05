import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Read width/height for a JPEG/PNG under `public/` (site-relative path).
 * Returns null for remote URLs, missing files, or unsupported formats.
 */
export async function publicImageSize(
  pathOrUrl: string | null | undefined,
): Promise<{ width: number; height: number } | null> {
  if (!pathOrUrl?.trim()) return null;
  const raw = pathOrUrl.trim();
  if (/^https?:\/\//i.test(raw)) return null;
  const rel = raw.startsWith("/") ? raw.slice(1) : raw;
  // Only probe files we ship (seed / brand); uploads may live on a CDN.
  if (!rel.startsWith("seed/") && !rel.startsWith("brand/")) return null;
  try {
    const buf = await readFile(join(process.cwd(), "public", rel));
    return jpegOrPngSize(buf);
  } catch {
    return null;
  }
}

function jpegOrPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    // PNG IHDR
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: scan for SOF0/SOF2
  let i = 0;
  while (i < buf.length - 8) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 1;
  }
  return null;
}
