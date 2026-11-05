import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Button shared focus (N1)", () => {
  const src = readFileSync(join(process.cwd(), "src/components/ui.tsx"), "utf8");

  it("uses the dark ring + buttermilk offset (not outline-bonnet)", () => {
    expect(src).toContain('import { BOOKING_CTA_FOCUS_CLASS } from "@/lib/booking-cta-focus"');
    const base = src.slice(
      src.indexOf("const buttonBase"),
      src.indexOf("export function Button"),
    );
    expect(base).toContain("BOOKING_CTA_FOCUS_CLASS");
    expect(base).not.toMatch(/outline-bonnet/);
  });
});
