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
    // Middleware no longer 404s non-admins (a rewrite leaks
    // x-middleware-rewrite), and layout + page render in parallel, so the
    // layout, every page (even redirect-only ones) and every route handler
    // must 404 non-admins themselves.
    const nestedLayouts = entry.filter(
      (p) => p.endsWith("layout.tsx") && p !== join(opsDir, "layout.tsx"),
    );
    for (const p of entry.filter((p) => !nestedLayouts.includes(p))) {
      expect(readFileSync(p, "utf8"), rel(p)).toMatch(/await requirePlatformAdminOr404\(\)/);
    }
    // Nested layouts stay static chrome (no data, no awaits) — the root ops
    // layout and the pages under them do the 404.
    for (const p of nestedLayouts) {
      const src = readFileSync(p, "utf8");
      expect(src, rel(p)).not.toMatch(/\bawait\b|prisma/);
    }
    // Every generateMetadata 404s non-admins before touching data.
    for (const p of entry) {
      const src = readFileSync(p, "utf8");
      const i = src.indexOf("generateMetadata(");
      if (i < 0) continue;
      const body = src.slice(i, src.indexOf("\nexport default", i));
      expect(body, rel(p)).toMatch(/await requirePlatformAdminOr404\(\)/);
      expect(body.indexOf("requirePlatformAdminOr404"), rel(p)).toBeLessThan(
        body.indexOf("prisma.") < 0 ? Infinity : body.indexOf("prisma."),
      );
    }
  });

  it("middleware never rewrites /ops to a not-found path", () => {
    for (const f of ["auth.config.ts", "middleware.ts"]) {
      const src = readFileSync(join(root, f), "utf8");
      expect(src, f).not.toMatch(/__not-found/);
      expect(src, f).not.toMatch(/NextResponse\.rewrite\([^)]*not-?found/i);
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
    const start = src.indexOf("async redirects()");
    expect(start).toBeGreaterThan(-1);
    const redirects = src.slice(start);
    expect(redirects).not.toMatch(/source:\s*["'`]\/ops/);
  });

  it("every /ops rewrite in next.config requires the middleware-only header", async () => {
    const { default: config } = await import("../../next.config");
    const { OPS_NOT_FOUND_HEADER } = await import("../auth.config");
    const r = await config.rewrites!();
    const all = Array.isArray(r) ? r : [...(r.beforeFiles ?? []), ...(r.afterFiles ?? []), ...(r.fallback ?? [])];
    const ops = all.filter((x) => x.source === "/ops" || x.source.startsWith("/ops/"));
    expect(ops.map((x) => x.source).sort()).toEqual(["/ops", "/ops/:path*"]);
    for (const x of ops) {
      expect(x.has).toEqual([{ type: "header", key: OPS_NOT_FOUND_HEADER, value: "1" }]);
      // Must land on a path with no route, so Next serves its stock 404.
      expect(x.destination).toBe("/__ops-not-found");
    }
  });

  it("middleware strips client copies of the ops 404 header and sets it only for non-admin /ops", () => {
    const src = readFileSync(join(root, "middleware.ts"), "utf8");
    expect(src).toMatch(/requestHeaders\.delete\(OPS_NOT_FOUND_HEADER\)/);
    expect(src.match(/\.set\(OPS_NOT_FOUND_HEADER/g)?.length).toBe(1);
  });

  it("login never shows an admin-only notice", () => {
    const src = readFileSync(join(root, "app", "login", "page.tsx"), "utf8");
    expect(src).not.toMatch(/platform admins only/i);
  });
});
