import { describe, expect, it } from "vitest";
import { listingCanonicalPath } from "@/lib/site-url";

describe("listingCanonicalPath", () => {
  it("has no ?host= query", () => {
    const p = listingCanonicalPath("lakefront");
    expect(p).toBe("/marketplace/properties/lakefront");
    expect(p).not.toContain("?");
  });
  it("encodes odd slugs", () => {
    expect(listingCanonicalPath("a b")).toBe("/marketplace/properties/a%20b");
  });
});

describe("marketplaceListingHref", () => {
  it("uses the clean canonical path when the slug is unique", async () => {
    const { marketplaceListingHref } = await import("./site-url");
    expect(marketplaceListingHref("kitchenette-2", "cherokee-landing", new Set())).toBe(
      "/marketplace/properties/kitchenette-2",
    );
  });
  it("keeps ?host= when another host shares the slug", async () => {
    const { marketplaceListingHref } = await import("./site-url");
    expect(
      marketplaceListingHref("cabin", "cherokee-landing", new Set(["cabin"])),
    ).toBe("/marketplace/properties/cabin?host=cherokee-landing");
  });
});
