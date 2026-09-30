import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PROPERTY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export type ImageExt = ".jpg" | ".png" | ".webp" | ".gif";

export type SavedImage = {
  bytes: Buffer;
  ext: ImageExt;
  filename: string;
};

export type UploadImageError = "missing" | "size" | "type";

const SEGMENT_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function sniffImageExt(buf: Buffer): ImageExt | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return ".png";
  }
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return ".gif";
  }
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return ".webp";
  }
  return null;
}

export async function readUploadedImage(
  file: File | null,
  opts?: { maxBytes?: number },
): Promise<
  { ok: true; image: SavedImage } | { ok: false; error: UploadImageError }
> {
  if (!file || file.size === 0) return { ok: false, error: "missing" };
  const maxBytes = opts?.maxBytes ?? IMAGE_MAX_BYTES;
  if (file.size > maxBytes) return { ok: false, error: "size" };

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = sniffImageExt(bytes);
  if (!ext) return { ok: false, error: "type" };

  return {
    ok: true,
    image: { bytes, ext, filename: `${randomUUID()}${ext}` },
  };
}

export function sniffRemoteImage(
  buf: Buffer,
  maxBytes = PROPERTY_IMAGE_MAX_BYTES,
): { ext: ImageExt } | null {
  if (buf.length < 2000 || buf.length > maxBytes) return null;
  const ext = sniffImageExt(buf);
  if (!ext) return null;
  return { ext };
}

function assertSafeSegment(segment: string) {
  if (!SEGMENT_RE.test(segment)) {
    throw new Error("Invalid upload path");
  }
}

/** Write under public/uploads/{segments...}/filename. Segments are allowlisted. */
export async function writePublicUpload(
  segments: string[],
  image: SavedImage,
): Promise<{ publicUrl: string; absPath: string }> {
  if (segments.length === 0) throw new Error("Invalid upload path");
  for (const segment of segments) assertSafeSegment(segment);

  const uploadDir = path.join(process.cwd(), "public", "uploads", ...segments);
  await mkdir(uploadDir, { recursive: true });
  const absPath = path.join(uploadDir, image.filename);
  await writeFile(absPath, image.bytes);
  const publicUrl = `/uploads/${segments.join("/")}/${image.filename}`;
  return { publicUrl, absPath };
}
