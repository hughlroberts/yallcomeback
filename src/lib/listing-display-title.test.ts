import { describe, expect, it } from "vitest";
import { isUntitledListing, listingDisplayTitle } from "./listing-display-title";

describe("listingDisplayTitle", () => {
  it("keeps a real title", () => {
    expect(listingDisplayTitle({ title: " Lake House ", city: "Austin" })).toBe("Lake House");
  });

  it("untitled draft with type and place", () => {
    expect(
      listingDisplayTitle({ title: "Untitled listing", propertyType: "cabin", city: "Austin", region: "TX" }),
    ).toBe("Draft · Cabin · Austin, TX");
  });

  it("untitled draft with no place uses the created day (host zone)", () => {
    // 02:30 UTC on Nov 3 is still Nov 2 in Central time.
    expect(
      listingDisplayTitle({
        title: "Untitled listing",
        propertyType: "house",
        createdAt: new Date("2026-11-03T02:30:00Z"),
      }),
    ).toBe("Draft · House · created Nov 2");
  });

  it("blank title falls back too; nothing known gives Draft", () => {
    expect(listingDisplayTitle({ title: "  " })).toBe("Draft");
    expect(listingDisplayTitle({ title: "Untitled listing", region: "OK" })).toBe("Draft · OK");
  });

  it("isUntitledListing", () => {
    expect(isUntitledListing("Untitled listing")).toBe(true);
    expect(isUntitledListing("")).toBe(true);
    expect(isUntitledListing("Cabin")).toBe(false);
  });
});
