import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("E1104-1/2 contrast", () => {
  it("open-source terminal headers use stone-300 on dark cards", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/open-source/page.tsx"),
      "utf8",
    );
    const headers = [...src.matchAll(/border-stone-800[\s\S]{0,200}text-stone-(\d{3})/g)];
    expect(headers.length).toBeGreaterThanOrEqual(2);
    for (const m of headers) expect(Number(m[1])).toBeLessThanOrEqual(300);
  });
  it("book deposit subcopy is full honey on bonnet", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/book/[slug]/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/text-honey(?!\/)/);
    expect(src).not.toMatch(/text-honey\/80/);
  });
});
