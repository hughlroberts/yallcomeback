import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { shouldResetScroll } from "@/lib/route-scroll";
import { buildOpenApiDocument } from "@/lib/agent/openapi";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("route change scroll reset", () => {
  const base = {
    prevPath: "/a",
    nextPath: "/b",
    hash: "",
    wasBackForward: false,
  };
  it("scrolls to the top on a normal navigation", () => {
    expect(shouldResetScroll(base)).toBe(true);
  });
  it("leaves the first load, same-path, back/forward and hash links alone", () => {
    expect(shouldResetScroll({ ...base, prevPath: null })).toBe(false);
    expect(shouldResetScroll({ ...base, nextPath: "/a" })).toBe(false);
    expect(shouldResetScroll({ ...base, wasBackForward: true })).toBe(false);
    expect(shouldResetScroll({ ...base, hash: "#reserve" })).toBe(false);
    expect(shouldResetScroll({ ...base, hash: "#" })).toBe(true);
  });
  it("is mounted once in the root layout", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout.match(/<RouteScrollReset \/>/g)).toHaveLength(1);
  });
});

describe("listing page on mobile", () => {
  const src = read("src/app/marketplace/properties/[slug]/page.tsx");
  it("renders exactly one booking widget", () => {
    expect(src.match(/<BookingWidget\b/g)).toHaveLength(1);
  });
  it("puts the reserve column above About on small screens, sticky sidebar on desktop", () => {
    const cls = (id: string) =>
      new RegExp(`data-testid="${id}"\\s+className="([^"]+)"`).exec(src)?.[1] ??
      "";
    expect(cls("listing-summary")).toMatch(/\border-1\b/);
    expect(cls("listing-reserve-column")).toMatch(/\border-2\b/);
    expect(cls("listing-details")).toMatch(/\border-3\b/);
    expect(cls("listing-reserve-column")).toContain("lg:sticky");
    for (const id of [
      "listing-summary",
      "listing-reserve-column",
      "listing-details",
    ]) {
      expect(cls(id)).toContain("lg:order-none");
    }
  });
});

describe("Cherokee Landing wording", () => {
  it("the brand-separation script no longer writes the 'not part of Cherokee Landing' sentence", () => {
    expect(read("scripts/separate-personal-from-cherokee.ts")).not.toContain(
      "not part of Cherokee Landing resort inventory",
    );
  });
});

describe("cancel wording", () => {
  it("help names the real confirm buttons and the 24-hour window", () => {
    const help = read("src/components/help/help-articles.tsx").replace(
      /\s+/g,
      " ",
    );
    expect(help).toContain("Yes, cancel request");
    expect(help).toContain("Yes, cancel booking");
    expect(help).toMatch(/24[- ]hour/);
    const panel = read("src/components/guest-cancel-panel.tsx");
    expect(panel).toContain("`Yes, cancel ${noun}`");
  });
  it("the confirmation cancel box mentions the free-cancel window", () => {
    const page = read("src/app/book/confirmation/[id]/page.tsx");
    expect(page).toContain("data-free-cancel-window");
    expect(page).toContain("cancelWin.inFreeCancelWindow");
    expect(page).toContain("cancelWin.freeCancelText");
    expect(page).toMatch(/deadlineText=\{`\$\{inFreeCancel/);
  });
});

describe("agent docs for pre-booking questions", () => {
  it("OpenAPI, llms.txt and agents.md describe POST /api/v1/inquiries", () => {
    const doc = buildOpenApiDocument("https://www.yallcomeback.app") as {
      paths: Record<string, { post?: { operationId?: string } }>;
    };
    expect(doc.paths["/api/v1/inquiries"]?.post?.operationId).toBe(
      "askHostQuestion",
    );
    expect(read("src/app/llms.txt/route.ts")).toContain("/api/v1/inquiries");
    expect(read("src/app/agents.md/route.ts")).toContain("/api/v1/inquiries");
  });
  it("CSP allows the optional Turnstile widget", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain("https://challenges.cloudflare.com");
  });
});
