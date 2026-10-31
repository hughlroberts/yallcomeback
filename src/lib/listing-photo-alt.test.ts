import { describe, expect, it } from "vitest";
import { listingPhotoAlt } from "@/lib/listing-photo-alt";

describe("listingPhotoAlt", () => {
  it("uses the listing title alone for the cover when there is no caption", () => {
    expect(listingPhotoAlt("Lake cabin")).toBe("Lake cabin");
    expect(listingPhotoAlt("Lake cabin", null, 0)).toBe("Lake cabin");
  });

  it("appends caption and photo index", () => {
    expect(listingPhotoAlt("Lake cabin", "Dock view", 0)).toBe(
      "Lake cabin — Dock view",
    );
    expect(listingPhotoAlt("Lake cabin", "Kitchen", 2)).toBe(
      "Lake cabin — Kitchen (photo 3)",
    );
    expect(listingPhotoAlt("Lake cabin", null, 1)).toBe("Lake cabin, photo 2");
  });

  it("does not repeat the title when caption matches", () => {
    expect(listingPhotoAlt("Lake cabin", "Lake cabin", 0)).toBe("Lake cabin");
    expect(listingPhotoAlt("Lake cabin", "Lake cabin", 1)).toBe(
      "Lake cabin, photo 2",
    );
  });

  it("replaces placeholder captions with '<title> exterior'", () => {
    expect(listingPhotoAlt("Motel Room 1", "Motel exterior placeholder", 0)).toBe(
      "Motel Room 1 exterior",
    );
    expect(listingPhotoAlt("Motel Room 2", "placeholder", 2)).toBe(
      "Motel Room 2 exterior (photo 3)",
    );
    expect(listingPhotoAlt("Cabin", "Placeholder kitchen", 0)).not.toMatch(
      /placeholder/i,
    );
  });
});
