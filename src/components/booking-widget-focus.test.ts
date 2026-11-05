import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("BookingWidget focus rings (E1104-4)", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/booking-widget.tsx"),
    "utf8",
  );

  it("Guests/Pets use inset focus rings (not clipped by overflow-hidden)", () => {
    // Wrapper must not use overflow-hidden (clips outline/ring-offset).
    expect(src).not.toMatch(
      /overflow-hidden rounded-xl border border-stone-300/,
    );
    expect(src).toMatch(
      /rounded-xl border border-stone-300">\s*\n\s*<label[\s\S]*?Guests/,
    );
    const selects = [...src.matchAll(/name="(guests|pets)"[\s\S]*?className="([^"]+)"/g)];
    expect(selects.map((m) => m[1]).sort()).toEqual(["guests", "pets"]);
    for (const m of selects) {
      expect(m[2], m[1]).toMatch(/focus:ring-2/);
      expect(m[2], m[1]).toMatch(/focus:ring-inset/);
      expect(m[2], m[1]).toMatch(/focus:ring-bonnet/);
    }
  });

  it("Request to book uses an inset focus-visible ring", () => {
    expect(src).toMatch(/focus-visible:ring-2/);
    expect(src).toMatch(/focus-visible:ring-inset/);
    expect(src).toMatch(/focus-visible:ring-white/);
    expect(src).toContain("Request to book");
  });
});
