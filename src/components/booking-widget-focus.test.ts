import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("E1104-4 booking widget focus rings", () => {
  it("Guests, Pets and Request to book show a focus-visible ring", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/booking-widget.tsx"),
      "utf8",
    );
    const selects = [...src.matchAll(/name="(guests|pets)"[\s\S]*?className="([^"]+)"/g)];
    expect(selects.length).toBeGreaterThanOrEqual(1);
    for (const m of selects) {
      expect(m[2], m[1]).toMatch(/focus-visible:outline-bonnet/);
    }
    expect(src).toMatch(
      /Request to book[\s\S]{0,80}|focus-visible:outline-white[\s\S]{0,200}Request to book/,
    );
    expect(src).toMatch(/focus-visible:outline-white/);
  });
});
