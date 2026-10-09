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
});
