import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("globals.css shared :focus-visible", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  it("defines shared focus tokens matching booking-cta-focus", () => {
    expect(css).toMatch(/--focus-ring-color:\s*#171717/);
    expect(css).toMatch(/--focus-ring-offset-color:\s*#fbf7ef/);
    expect(css).toMatch(/--focus-ring-width:\s*2px/);
    expect(css).toMatch(/--focus-ring-offset-width:\s*2px/);
  });

  it("applies a base :focus-visible ring in @layer base", () => {
    expect(css).toMatch(/@layer base\s*\{[\s\S]*?:focus-visible/);
    expect(css).toMatch(/box-shadow:[\s\S]*var\(--focus-ring-offset-color\)/);
  });

  it("supports dark-section override via class and data attribute", () => {
    expect(css).toContain(".focus-ring-on-dark");
    expect(css).toContain('[data-focus-ring="dark"]');
    expect(css).toMatch(
      /\[data-focus-ring="dark"\][\s\S]*--focus-ring-color:\s*#fbf7ef/,
    );
  });
});
