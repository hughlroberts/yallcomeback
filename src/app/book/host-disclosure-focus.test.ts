import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("E1104-3 host disclosure scroll region", () => {
  it("is keyboard-focusable with a label and focus ring", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/book/[slug]/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/max-h-64[\s\S]{0,200}tabIndex=\{0\}/);
    expect(src).toMatch(/aria-label="Host disclosure"/);
    expect(src).toMatch(/role="region"/);
    expect(src).toContain("PRIMARY_CTA_FOCUS_CLASS");
    expect(src).not.toMatch(/focus-visible:outline-bonnet/);
  });
});
