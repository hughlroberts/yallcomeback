import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

const root = path.resolve(__dirname, "../..");
const appDir = path.join(root, "src/app");

/** Does a static /admin/... path match a page route (dynamic segments allowed)? */
function routeExists(urlPath: string): boolean {
  const segs = urlPath.split("/").filter(Boolean);
  function walk(dir: string, i: number): boolean {
    if (i === segs.length) {
      return ["page.tsx", "page.ts", "route.ts"].some((f) =>
        existsSync(path.join(dir, f)),
      );
    }
    if (!existsSync(dir)) return false;
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (!statSync(full).isDirectory()) continue;
      if (/^\(.*\)$/.test(name) && walk(full, i)) return true;
      if (name === segs[i] && walk(full, i + 1)) return true;
      if (/^\[[^.]+\]$/.test(name) && walk(full, i + 1)) return true;
    }
    return false;
  }
  return walk(appDir, 0);
}

async function redirects() {
  return (await nextConfig.redirects!()) as {
    source: string;
    destination: string;
  }[];
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
      out.push(full);
  }
  return out;
}

describe("admin nav routes", () => {
  it.each([
    ["/admin/subscription", "/account/settings/subscription"],
    ["/admin/billing", "/account/settings/subscription"],
    ["/admin/domain", "/admin/brand"],
    ["/admin/domains", "/admin/brand"],
    ["/admin/website", "/admin/brand"],
  ])("%s goes to a real page (%s)", async (from, to) => {
    const r = (await redirects()).find((x) => x.source === from);
    expect(r?.destination).toBe(to);
    expect(routeExists(to)).toBe(true);
  });

  // Links Next can prefetch: href props/objects, router.push/prefetch, redirect().
  it("every literal /admin link in the app resolves to a page or redirect", async () => {
    const sources = new Set((await redirects()).map((r) => r.source));
    const bad: string[] = [];
    for (const file of sourceFiles(path.join(root, "src"))) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(
        /(?:href\s*[=:]\s*\{?\s*|(?:push|replace|prefetch|redirect)\(\s*)["'`](\/admin(?:\/[a-z0-9-]+)*)\/?(?=[?#"'`])/g,
      )) {
        const p = m[1]!;
        if (!routeExists(p) && !sources.has(p)) {
          bad.push(`${path.relative(root, file)}: ${p}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
