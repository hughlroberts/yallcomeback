import { describe, expect, it } from "vitest";
import { stripImageMetadata } from "@/lib/upload-image";

function jpegWithExif(): Buffer {
  const payload = Buffer.from("Exif\0\0GPSLatitude\0");
  const len = payload.length + 2;
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (len >> 8) & 0xff, len & 0xff]),
    payload,
  ]);
  const sos = Buffer.from([
    0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xd9,
  ]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, sos]);
}

function pngWithText(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  const ihdr = Buffer.alloc(12 + 13);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4);
  ihdrData.copy(ihdr, 8);
  const textData = Buffer.from("GPSLatitude\0hidden");
  const text = Buffer.alloc(12 + textData.length);
  text.writeUInt32BE(textData.length, 0);
  text.write("tEXt", 4);
  textData.copy(text, 8);
  const iend = Buffer.alloc(12);
  iend.write("IEND", 4);
  return Buffer.concat([sig, ihdr, text, iend]);
}

describe("stripImageMetadata", () => {
  it("drops JPEG APP1 EXIF / GPS", () => {
    const raw = jpegWithExif();
    expect(raw.includes(Buffer.from("Exif"))).toBe(true);
    expect(raw.includes(Buffer.from("GPSLatitude"))).toBe(true);
    const out = stripImageMetadata(raw);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(out.includes(Buffer.from("Exif"))).toBe(false);
    expect(out.includes(Buffer.from("GPSLatitude"))).toBe(false);
    expect(out.includes(Buffer.from([0xff, 0xda]))).toBe(true);
  });

  it("drops PNG tEXt GPS", () => {
    const raw = pngWithText();
    expect(raw.includes(Buffer.from("GPSLatitude"))).toBe(true);
    const out = stripImageMetadata(raw);
    expect(out.subarray(0, 8).equals(raw.subarray(0, 8))).toBe(true);
    expect(out.includes(Buffer.from("IHDR"))).toBe(true);
    expect(out.includes(Buffer.from("IEND"))).toBe(true);
    expect(out.includes(Buffer.from("GPSLatitude"))).toBe(false);
  });
});
