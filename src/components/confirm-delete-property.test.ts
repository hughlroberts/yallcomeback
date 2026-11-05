import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ConfirmDeleteProperty E1104-A5", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/confirm-delete-property.tsx"),
    "utf8",
  );

  it("collapsed Danger zone has expand affordance and hint", () => {
    expect(src).toContain('aria-expanded={open}');
    expect(src).toContain("permanently delete this listing");
    expect(src).toMatch(/open \? "▾" : "▸"/);
  });
});
