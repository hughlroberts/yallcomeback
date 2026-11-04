import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createListingPreviewToken,
  pausedPreviewHref,
  PREVIEW_TOKEN_TTL_SECONDS,
  verifyListingPreviewToken,
} from "./listing-preview-token";

describe("T58 listing preview token", () => {
  const prev = process.env.AUTH_SECRET;
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-only-secret-not-real-0123456789";
  });
  afterEach(() => {
    process.env.AUTH_SECRET = prev;
  });

  it("verifies for the same listing before expiry", () => {
    const t = createListingPreviewToken("prop1", 1_000_000);
    expect(verifyListingPreviewToken(t, "prop1", 1_000_000)).toBe(true);
  });
  it("rejects another listing, expiry, tampering and junk", () => {
    const t = createListingPreviewToken("prop1", 1_000_000);
    expect(verifyListingPreviewToken(t, "prop2", 1_000_000)).toBe(false);
    expect(
      verifyListingPreviewToken(t, "prop1", 1_000_000 + (PREVIEW_TOKEN_TTL_SECONDS + 5) * 1000),
    ).toBe(false);
    const [exp, sig] = t.split(".");
    expect(verifyListingPreviewToken(`${Number(exp) + 999}.${sig}`, "prop1", 1_000_000)).toBe(false);
    expect(verifyListingPreviewToken("nope", "prop1")).toBe(false);
    expect(verifyListingPreviewToken(undefined, "prop1")).toBe(false);
  });
  it("builds the Find a Place preview URL with host and token", () => {
    const href = pausedPreviewHref("my stay", "brand-a", "prop1", 1_000_000);
    const u = new URL(href, "http://x");
    expect(u.pathname).toBe("/marketplace/properties/my%20stay");
    expect(u.searchParams.get("host")).toBe("brand-a");
    expect(verifyListingPreviewToken(u.searchParams.get("preview"), "prop1", 1_000_000)).toBe(true);
  });
});
