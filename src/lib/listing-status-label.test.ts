import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listingStatus, listingStatusLabel } from "./listing-status-label";

const base = { title: "QA Cabin", published: false, listOnMarketplace: true, archivedAt: null };

describe("T48(3) shared listing status label", () => {
  it("unpublished titled listing with marketplace flag is Paused (not 'Draft, Marketplace')", () => {
    expect(listingStatus(base)).toBe("Paused");
    expect(listingStatusLabel(base)).toBe("Paused");
  });
  it("untitled unpublished is Draft", () => {
    expect(listingStatusLabel({ ...base, title: "Untitled listing" })).toBe("Draft");
  });
  it("published is Live with where it shows", () => {
    expect(listingStatusLabel({ ...base, published: true })).toBe("Live · website + Find a Place");
    expect(listingStatusLabel({ ...base, published: true, listOnMarketplace: false })).toBe("Live · website only");
  });
  it("archived wins", () => {
    expect(listingStatusLabel({ ...base, published: true, archivedAt: new Date() })).toBe("Archived");
  });
  it("admin and ops render the same helper, not their own labels", () => {
    const root = path.resolve(__dirname, "..");
    for (const f of [
      "components/admin-listing-workspace.tsx",
      "app/admin/properties/page.tsx",
      "app/ops/hosting/[hostId]/page.tsx",
    ]) {
      const s = readFileSync(path.join(root, f), "utf8");
      expect(s).toContain("listingStatusLabel(");
      expect(s).not.toMatch(/"Inactive"|>\s*Draft\s*<|>\s*Marketplace\s*</);
    }
  });
});
