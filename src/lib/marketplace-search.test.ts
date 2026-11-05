import { describe, expect, it } from "vitest";
import { marketplaceTextSearchOr } from "./marketplace-search";

describe("marketplaceTextSearchOr", () => {
  it("does not search street address or postal code", () => {
    const keys = marketplaceTextSearchOr("oak").flatMap((clause) =>
      Object.keys(clause),
    );
    expect(keys).not.toContain("address");
    expect(keys).not.toContain("postalCode");
    expect(keys).toEqual(
      expect.arrayContaining(["title", "city", "region", "country"]),
    );
  });

  it("F5: partial/word queries use case-insensitive contains (same stays as full name)", () => {
    const cedar = marketplaceTextSearchOr("cedar");
    const full = marketplaceTextSearchOr("Cedar Creek Lake");
    const lake = marketplaceTextSearchOr("lake");

    for (const clause of [...cedar, ...full, ...lake]) {
      const field = Object.values(clause)[0] as
        | { contains: string; mode?: string }
        | { name: { contains: string; mode?: string } };
      const contains =
        field && typeof field === "object" && "contains" in field
          ? field
          : (field as { name: { contains: string; mode?: string } }).name;
      expect(contains.mode).toBe("insensitive");
    }

    // Same fields for partial and full — Prisma insensitive contains makes
    // "cedar" match "Cedar Creek Lake" the same way the full string does.
    expect(cedar.map((c) => Object.keys(c)[0])).toEqual(
      full.map((c) => Object.keys(c)[0]),
    );
    expect(cedar.find((c) => "location" in c)).toEqual({
      location: { name: { contains: "cedar", mode: "insensitive" } },
    });
    expect(full.find((c) => "location" in c)).toEqual({
      location: {
        name: { contains: "Cedar Creek Lake", mode: "insensitive" },
      },
    });
    expect(lake.find((c) => "location" in c)).toEqual({
      location: { name: { contains: "lake", mode: "insensitive" } },
    });
  });
});
