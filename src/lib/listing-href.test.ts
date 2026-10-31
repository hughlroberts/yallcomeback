import { describe, expect, it } from "vitest";
import { listingHrefWithSearch } from "@/lib/listing-href";

describe("listingHrefWithSearch", () => {
  it("keeps ?host= when no ambiguity set is given (legacy)", () => {
    expect(listingHrefWithSearch("cabin", "acme", {})).toBe(
      "/marketplace/properties/cabin?host=acme",
    );
  });
  it("drops ?host= for unique slugs", () => {
    expect(listingHrefWithSearch("cabin", "acme", {}, new Set())).toBe(
      "/marketplace/properties/cabin",
    );
    expect(
      listingHrefWithSearch("cabin", "acme", { guests: 2 }, new Set(["other"])),
    ).toBe("/marketplace/properties/cabin?guests=2");
  });
  it("keeps ?host= for shared slugs", () => {
    expect(
      listingHrefWithSearch("cabin", "acme", { checkIn: "2026-11-01" }, new Set(["cabin"])),
    ).toBe("/marketplace/properties/cabin?host=acme&checkIn=2026-11-01");
  });
});
