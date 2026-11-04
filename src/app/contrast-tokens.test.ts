import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("R1104-15 muted text tokens meet WCAG AA", () => {
  for (const name of ["stone-400", "stone-500", "slate-400", "slate-500"]) {
    it(name, () => {
      const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"));
      expect(m).toBeTruthy();
      for (const bg of ["#ffffff", "#fbf7ef", "#f9f3e6"]) {
        expect(ratio(m![1], bg)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
