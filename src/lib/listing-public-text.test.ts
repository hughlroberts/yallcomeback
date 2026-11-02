import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { publicListingText } from "./listing-public-text";

describe("publicListingText", () => {
  it("drops the import note (live lakefront shape, CRLF)", () => {
    const raw =
      "Game room for pingpong.\r\n\r\nDon’t have a boat? Check them out online.\r\n\r\n—\r\nImported from Airbnb\r\nhttps://www.airbnb.com/rooms/600541790815158094";
    expect(publicListingText(raw)).toBe(
      "Game room for pingpong.\n\nDon’t have a boat? Check them out online.",
    );
  });

  it("drops the note with ID and importer notes (upper-case source)", () => {
    const raw =
      "Two bedrooms.\n\n—\nImported from AIRBNB\nhttps://www.airbnb.com/rooms/1498\nID 1498\nRaw note";
    expect(publicListingText(raw)).toBe("Two bedrooms.");
  });

  it("drops an Imported from line without a separator", () => {
    expect(
      publicListingText(
        "Nice place.\nImported from VRBO\nhttps://www.vrbo.com/123",
      ),
    ).toBe("Nice place.");
  });

  it("removes airbnb.com links elsewhere but keeps the sentence", () => {
    expect(
      publicListingText(
        "See reviews at https://www.airbnb.com/rooms/1 before booking.\nAirbnb: airbnb.com/rooms/2\nhttps://airbnb.com/h/lake\nThanks!",
      ),
    ).toBe("See reviews at before booking.\nThanks!");
  });

  it("leaves other text and links alone", () => {
    const raw =
      "Lake house.\n\n— Quiet hours after 10pm\nhttps://cherokeelanding.com";
    expect(publicListingText(raw)).toBe(raw);
  });

  it("returns null for empty or note-only text", () => {
    expect(publicListingText(null)).toBeNull();
    expect(publicListingText("   ")).toBeNull();
    expect(
      publicListingText(
        "—\nImported from Airbnb\nhttps://www.airbnb.com/rooms/1",
      ),
    ).toBeNull();
  });
});

describe("import note is hidden wherever the description is shown", () => {
  const read = (p: string) =>
    readFileSync(path.resolve(__dirname, "..", p), "utf8");
  it.each([
    "app/marketplace/properties/[slug]/page.tsx",
    "app/book/[slug]/page.tsx",
    "lib/agent/listing.ts",
    "app/h/[hostSlug]/page.tsx",
    "app/h/[hostSlug]/about/page.tsx",
    "components/meet-your-host.tsx",
    "lib/host-meta.ts",
  ])("%s uses publicListingText", (p) => {
    expect(read(p)).toContain("publicListingText(");
  });

  it("listing page no longer renders the raw description", () => {
    const page = read("app/marketplace/properties/[slug]/page.tsx");
    expect(page).not.toMatch(/\{property\.description\}/);
    expect(page).not.toMatch(/description=\{property\.description/);
  });
});
