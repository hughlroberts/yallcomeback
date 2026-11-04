import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRIVATE_PREVIEW_LABEL } from "./private-preview-label";
import { PREVIEW_TOKEN_TTL_SECONDS } from "./listing-preview-token";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("paused preview admin label", () => {
  it("says private preview and matches the 2 h token TTL", () => {
    expect(PRIVATE_PREVIEW_LABEL).toBe("Private preview (link works for 2 hours)");
    expect(PREVIEW_TOKEN_TTL_SECONDS).toBe(2 * 60 * 60);
  });
  it("admin surfaces use the label and drop 'only you can see'", () => {
    for (const f of ["components/admin-listing-workspace.tsx", "app/admin/properties/page.tsx"]) {
      const s = src(f);
      expect(s).toContain("PRIVATE_PREVIEW_LABEL");
      expect(s).not.toMatch(/Preview \(only you can see it\)|preview only you can see/);
    }
  });
});
