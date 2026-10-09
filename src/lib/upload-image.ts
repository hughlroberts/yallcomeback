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

  const raw = Buffer.from(await file.arrayBuffer());
  const ext = sniffImageExt(raw);
  if (!ext) return { ok: false, error: "type" };
  const bytes = stripImageMetadata(raw);

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

/**
 * Drop GPS / EXIF / XMP / IPTC from listing photos before they hit disk.
 * JPEG: APP1 + APP13 + COM. PNG: eXIf and text chunks. WebP: EXIF + XMP.
 */
export function stripImageMetadata(buf: Buffer): Buffer {
  try {
    const ext = sniffImageExt(buf);
    if (ext === ".jpg") return stripJpegMetadata(buf);
    if (ext === ".png") return stripPngMetadata(buf);
    if (ext === ".webp") return stripWebpMetadata(buf);
  } catch {
    return buf;
  }
  return buf;
}

function stripJpegMetadata(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const chunks: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      chunks.push(buf.subarray(i));
      break;
    }
    let j = i;
    while (j < buf.length && buf[j] === 0xff) j += 1;
    if (j >= buf.length) {
      chunks.push(buf.subarray(i));
      break;
    }
    const marker = buf[j]!;
    if (marker === 0xd9) {
      chunks.push(Buffer.from([0xff, 0xd9]));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(Buffer.from([0xff, marker]));
      i = j + 1;
      continue;
    }
    if (j + 3 >= buf.length) {
      chunks.push(buf.subarray(i));
      break;
    }
    const len = buf.readUInt16BE(j + 1);
    const next = j + 1 + len;
    if (len < 2 || next > buf.length) {
      chunks.push(buf.subarray(i));
      break;
    }
    const headerStart = j - 1;
    if (marker === 0xda) {
      chunks.push(buf.subarray(headerStart));
      break;
    }
    const skip = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!skip) chunks.push(buf.subarray(headerStart, next));
    i = next;
  }
  const out = Buffer.concat(chunks);
  return out.length >= 4 && out[0] === 0xff && out[1] === 0xd8 ? out : buf;
}

function stripPngMetadata(buf: Buffer): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 16 || !buf.subarray(0, 8).equals(sig)) return buf;
  const drop = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  const chunks: Buffer[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const dataLen = buf.readUInt32BE(i);
    const total = 12 + dataLen;
    if (i + total > buf.length) {
      chunks.push(buf.subarray(i));
      break;
    }
    const type = buf.toString("ascii", i + 4, i + 8);
    if (!drop.has(type)) chunks.push(buf.subarray(i, i + total));
    i += total;
    if (type === "IEND") break;
  }
  return Buffer.concat(chunks);
}

function stripWebpMetadata(buf: Buffer): Buffer {
  if (
    buf.length < 20 ||
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return buf;
  }
  const kept: Buffer[] = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const fourcc = buf.toString("ascii", i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const payload = 8 + size + (size % 2);
    if (i + payload > buf.length) {
      kept.push(buf.subarray(i));
      break;
    }
    if (fourcc !== "EXIF" && fourcc !== "XMP ") {
      kept.push(buf.subarray(i, i + payload));
    }
    i += payload;
  }
  const body = Buffer.concat(kept);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0);
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8);
  return Buffer.concat([header, body]);
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
  await writeFile(absPath, stripImageMetadata(image.bytes));
  const publicUrl = `/uploads/${segments.join("/")}/${image.filename}`;
  return { publicUrl, absPath };
}
