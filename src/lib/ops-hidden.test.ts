import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * /ops is internal (platform admins only). Static guards so a new ops page,
 * route handler, or client component can't leak it to hosts or visitors.
 */
const root = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const all = walk(root).filter((p) => /\.(tsx?|mts)$/.test(p) && !p.endsWith(".test.ts"));
const opsDir = join(root, "app", "ops");
const opsFiles = all.filter((p) => p.startsWith(opsDir + "/"));
const rel = (p: string) => p.slice(root.length + 1);

describe("/ops stays hidden", () => {
  it("ops layout, pages and route handlers 404 non-admins (no login/notice)", () => {
    const entry = opsFiles.filter((p) => /\/(page|layout|route)\.tsx?$/.test(p));
    expect(entry.length).toBeGreaterThan(5);
    for (const p of entry) {
      const src = readFileSync(p, "utf8");
      expect(src, rel(p)).not.toMatch(/redirect\(\s*["`]\/login/);
      expect(src, rel(p)).not.toMatch(/admin_only/);
      expect(src, rel(p)).not.toMatch(/status:\s*40[13]/);
      // Any check of the platform role must be the 404 variant.
      expect(src, rel(p)).not.toMatch(/requirePlatformAdmin\(\)/);
    }
    for (const p of [join(opsDir, "layout.tsx"), ...entry.filter((p) => p.endsWith("route.ts"))]) {
      expect(readFileSync(p, "utf8"), rel(p)).toMatch(/requirePlatformAdminOr404\(\)/);
    }
  });

  it("no client component outside ops ships an /ops path", () => {
    const leaks = all
      .filter((p) => !p.startsWith(opsDir + "/"))
      .filter((p) => !/\/components\/ops-[^/]+\.tsx$/.test(p))
      .filter((p) => {
        const src = readFileSync(p, "utf8");
        if (!/^\s*["']use client["']/.test(src)) return false;
        // Strip comments, then look for an /ops string literal.
        const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
        return /["'`]\/ops(["'`/?])/.test(code);
      })
      .map(rel);
    expect(leaks).toEqual([]);
  });

  it("next.config has no /ops redirects (they run before middleware)", () => {
    const src = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(src).not.toMatch(/source:\s*["'`]\/ops/);
  });

  it("login never shows an admin-only notice", () => {
    const src = readFileSync(join(root, "app", "login", "page.tsx"), "utf8");
    expect(src).not.toMatch(/platform admins only/i);
  });
});
