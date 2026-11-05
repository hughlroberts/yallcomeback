import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOOKING_CTA_FOCUS_CLASS,
  BOOKING_CTA_FOCUS_CONTRAST,
} from "@/lib/booking-cta-focus";

describe("BookingWidget focus rings (E1104-4)", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/booking-widget.tsx"),
    "utf8",
  );
  const mobile = readFileSync(
    join(process.cwd(), "src/components/mobile-reserve-bar.tsx"),
    "utf8",
  );

  it("Guests/Pets use inset focus rings (not clipped by overflow-hidden)", () => {
    expect(src).not.toMatch(
      /overflow-hidden rounded-xl border border-stone-300/,
    );
    expect(src).toMatch(
      /rounded-xl border border-stone-300">\s*\n\s*<label[\s\S]*?Guests/,
    );
    const selects = [
      ...src.matchAll(/name="(guests|pets)"[\s\S]*?className="([^"]+)"/g),
    ];
    expect(selects.map((m) => m[1]).sort()).toEqual(["guests", "pets"]);
    for (const m of selects) {
      expect(m[2], m[1]).toMatch(/focus:ring-2/);
      expect(m[2], m[1]).toMatch(/focus:ring-inset/);
      expect(m[2], m[1]).toMatch(/focus:ring-bonnet/);
    }
  });

  it("Request to book uses a 2px dark ring + 2px buttermilk offset (≥3:1)", () => {
    expect(BOOKING_CTA_FOCUS_CLASS).toMatch(/focus-visible:ring-2/);
    expect(BOOKING_CTA_FOCUS_CLASS).toMatch(/focus-visible:ring-offset-2/);
    expect(BOOKING_CTA_FOCUS_CLASS).toContain("ring-[#171717]");
    expect(BOOKING_CTA_FOCUS_CLASS).toContain("ring-offset-buttermilk");
    expect(BOOKING_CTA_FOCUS_CLASS).not.toMatch(/ring-inset/);
    expect(BOOKING_CTA_FOCUS_CLASS).not.toMatch(/ring-white/);

    expect(BOOKING_CTA_FOCUS_CONTRAST.ringVsOffset).toBeGreaterThanOrEqual(3);
    expect(BOOKING_CTA_FOCUS_CONTRAST.offsetVsButton).toBeGreaterThanOrEqual(3);

    expect(src).toContain("BOOKING_CTA_FOCUS_CLASS");
    expect(src).toContain("Request to book");
    // Parent must not clip the offset ring.
    expect(src).toMatch(/data-testid="booking-card"[\s\S]*?lg:overflow-visible/);
    expect(src).toMatch(
      /data-testid="booking-card-footer"\s+className="[^"]*overflow-visible/,
    );
  });

  it("mobile sticky Reserve / Request to book uses the same focus ring", () => {
    expect(mobile).toContain("BOOKING_CTA_FOCUS_CLASS");
    expect(mobile).toMatch(/overflow-visible border-t border-stone-200/);
    expect(mobile).not.toMatch(/outline-white/);
  });
});

describe("booking CTA focus contrast math", () => {
  function lum(hex: string) {
    const h = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const f = (c: number) =>
      c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function contrast(a: string, b: string) {
    const [L1, L2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (L1 + 0.05) / (L2 + 0.05);
  }

  it("reported ratios match WCAG relative luminance", () => {
    const { ring, offset, button, ringVsOffset, offsetVsButton } =
      BOOKING_CTA_FOCUS_CONTRAST;
    expect(contrast(ring, offset)).toBeCloseTo(ringVsOffset, 1);
    expect(contrast(offset, button)).toBeCloseTo(offsetVsButton, 1);
  });
});
