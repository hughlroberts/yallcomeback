import { describe, expect, it } from "vitest";
import { marketplaceListingHref } from "./marketplace-links";

describe("marketplaceListingHref (T58)", () => {
  it("builds the public Find a Place path", () => {
    expect(marketplaceListingHref("lake-house", "hugh")).toBe("/marketplace/properties/lake-house?host=hugh");
    expect(marketplaceListingHref("lake-house")).toBe("/marketplace/properties/lake-house");
    expect(marketplaceListingHref("a b", "c&d")).toBe("/marketplace/properties/a%20b?host=c%26d");
  });
});
