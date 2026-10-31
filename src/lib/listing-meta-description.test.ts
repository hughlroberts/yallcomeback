import { describe, expect, it } from "vitest";
import { listingMetaDescription } from "@/lib/listing-meta-description";

describe("listingMetaDescription", () => {
  const shared = {
    tagline: "Cozy kitchenette steps from the lake.",
    city: "Cherokee",
    region: "TX",
    hostName: "Cherokee Landing",
  };

  it("differs for sibling listings that share a tagline", () => {
    const a = listingMetaDescription({
      ...shared,
      title: "Kitchenette 1",
      maxGuests: 2,
      beds: 1,
    });
    const b = listingMetaDescription({
      ...shared,
      title: "Kitchenette 2",
      maxGuests: 4,
      beds: 2,
    });
    expect(a).not.toBe(b);
    expect(a).toContain("Kitchenette 1");
    expect(a).toContain("sleeps 2");
    expect(b).toContain("2 beds");
    expect(a).toContain("Cozy kitchenette");
  });

  it("stays within 160 characters", () => {
    const d = listingMetaDescription({
      title: "Motel Room 1",
      description: "x ".repeat(300),
      maxGuests: 2,
      beds: 1,
      hostName: "Cherokee Landing",
    });
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.startsWith("Motel Room 1")).toBe(true);
  });

  it("falls back to a book-direct line", () => {
    expect(listingMetaDescription({ title: "Cabin", hostName: "Sam" })).toBe(
      "Cabin · hosted by Sam. Book direct with Sam.",
    );
  });
});
