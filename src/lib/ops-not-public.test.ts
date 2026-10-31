import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/messaging", () => ({ dispatchEmail: vi.fn() }));
vi.mock("@/lib/notification-prefs", () => ({ canSendEmailTo: vi.fn() }));
vi.mock("@/lib/platform-domains", () => ({
  ensurePlatformCustomDomain: vi.fn(),
}));

import { dnsInstructionsBody } from "./domain-setup";
import { buildOpenApiDocument } from "./agent/openapi";

/**
 * /ops is internal (platform admins only). Text that guests, visitors or
 * hosts can see must never name it. Code comments and admin-gated
 * redirect()/revalidatePath() calls are not visible, so they are stripped.
 */
const VISIBLE_TO_PUBLIC_OR_HOSTS = [
  "src/app/terms/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/self-host/page.tsx",
  "src/app/open-source/page.tsx",
  "src/app/for-hosts/page.tsx",
  "src/app/help",
  "src/app/llms.txt/route.ts",
  "src/app/agents.md/route.ts",
  "src/lib/agent/openapi.ts",
  "src/app/admin/brand/page.tsx",
  "src/app/admin/pricing/page.tsx",
  "src/app/admin/hosting/page.tsx",
  "src/lib/host-access.ts",
  "src/lib/platform-domains.ts",
  "src/lib/pricing-intelligence/run.ts",
  "src/lib/features.ts",
];

const OPS = /\bops\b/i;

function visibleText(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .split("\n")
    .filter((l) => !/\b(redirect|revalidatePath)\(\s*["'`]\/ops/.test(l))
    .join("\n");
}

function files(rel: string): string[] {
  const abs = path.join(process.cwd(), rel);
  try {
    return [readFileSync(abs, "utf8")];
  } catch {
    // directory: every source file inside
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|md)$/.test(name) && !name.includes(".test."))
          out.push(readFileSync(p, "utf8"));
      }
    };
    try {
      walk(abs);
    } catch {
      /* missing dir */
    }
    return out;
  }
}

describe("internal ops console is never named publicly", () => {
  it.each(VISIBLE_TO_PUBLIC_OR_HOSTS)(
    "%s has no visible Ops or /ops text",
    (rel) => {
      for (const src of files(rel)) {
        const hits = visibleText(src)
          .split("\n")
          .filter((l) => OPS.test(l));
        expect(hits).toEqual([]);
      }
    },
  );

  it("terms say 'until we notify you otherwise'", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/app/terms/page.tsx"),
      "utf8",
    );
    expect(src.replace(/\s+/g, " ")).toContain("until we notify you otherwise");
  });

  it("host DNS panel copy does not mention Ops", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/domain-dns-panel.tsx"),
      "utf8",
    );
    expect(src).not.toContain("Ops was notified");
  });

  it("the host-visible domain setup message has no Ops line or /ops link", () => {
    const base = {
      hostName: "Lakeside",
      bare: "lakeside.com",
      wwwHost: "www.lakeside.com",
      status: "FAILED",
      cnameHost: null,
      cnameTarget: null,
      txtHost: null,
      txtValue: null,
      error: "Auto-provision unavailable",
      brandPath: "https://www.yallcomeback.app/admin/brand?hostId=h1",
    };
    for (const body of [
      dnsInstructionsBody(base),
      dnsInstructionsBody({
        ...base,
        status: "READY",
        cnameHost: "www",
        cnameTarget: "x.example.net",
        error: null,
      }),
    ]) {
      expect(body).not.toMatch(OPS);
      expect(body).toContain("/admin/brand");
    }
  });

  it("OpenAPI document does not mention ops", () => {
    expect(
      JSON.stringify(buildOpenApiDocument("https://www.yallcomeback.app")),
    ).not.toMatch(OPS);
  });
});
