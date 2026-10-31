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
