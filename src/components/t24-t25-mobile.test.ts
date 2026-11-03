import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("T24 booking widget form fields", () => {
  it("every select has a name", () => {
    const src = read("src/components/booking-widget.tsx");
    const selects = src.match(/<select\b[^>]*>/g) ?? [];
    expect(selects.length).toBeGreaterThan(0);
    for (const s of selects) expect(s).toMatch(/\b(name|id)=/);
  });
});

describe("T25 compact admin header", () => {
  it("brand bar toggle has no ops path and the exit label is Platform admin", () => {
    expect(read("src/components/admin-brand-bar-toggle.tsx")).not.toContain("/ops");
    const sw = read("src/components/admin-brand-switcher.tsx");
    expect(sw).toContain("Platform admin");
    expect(sw).not.toContain("Ops Panel");
  });
  it("admin nav is one row on phones", () => {
    const nav = read("src/components/admin-nav.tsx");
    expect(nav).toContain("flex-row items-center");
    expect(nav).toContain('aria-label="Book a stay"');
  });
});
