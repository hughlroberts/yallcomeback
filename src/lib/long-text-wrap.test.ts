import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Host- and guest-written text (descriptions, rules, messages, notes) can
 * hold long URLs. With whitespace-pre-wrap alone a long URL widened the
 * listing page to ~425px at a 390px phone width. Every such block must also
 * allow breaking inside long words (unless it scrolls on its own).
 */
function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

describe("long user text wraps on phones", () => {
  it("whitespace-pre-wrap blocks also break long words", () => {
    const root = path.resolve(__dirname, "..");
    const bad: string[] = [];
    for (const f of files(root)) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(
        /className="([^"]*whitespace-pre-wrap[^"]*)"/g,
      )) {
        const cls = m[1]!;
        if (/overflow-(y-)?auto/.test(cls)) continue;
        if (!cls.includes("[overflow-wrap:anywhere]")) {
          bad.push(`${path.relative(root, f)}: ${cls}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("the listing description is covered", () => {
    const page = readFileSync(
      path.resolve(__dirname, "../app/marketplace/properties/[slug]/page.tsx"),
      "utf8",
    );
    expect(page).toMatch(
      /whitespace-pre-wrap break-words \[overflow-wrap:anywhere\] leading-relaxed/,
    );
  });
});
