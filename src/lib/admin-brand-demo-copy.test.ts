import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SUBSCRIBE_CHECKOUT_LABEL } from "@/lib/billing-labels";
import { adminBrandDemoSiteCopy } from "./admin-brand-demo-copy";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const live = {
  slug: "qa-marketplace-test",
  hostingMode: "PLATFORM",
  marketplaceSuspendedAt: null,
};

const hidden = {
  ...live,
  marketplaceSuspendedAt: new Date("2026-11-01T00:00:00Z"),
};

describe("adminBrandDemoSiteCopy (K2)", () => {
  it("keeps the included-on-every-plan wording when the demo is public", () => {
    const copy = adminBrandDemoSiteCopy(live);
    expect(copy.hidden).toBe(false);
    expect(copy.text).toBe(
      "A branded demo site at /h/qa-marketplace-test is included on every plan, including Marketplace only — you can build it without upgrading.",
    );
    expect(copy.text).not.toMatch(/\bfree\b/i);
    expect(copy.text).not.toMatch(/not live/i);
  });

  it("says why the demo is hidden and what restores it, without claiming it is live", () => {
    const copy = adminBrandDemoSiteCopy(hidden);
    expect(copy.hidden).toBe(true);
    expect(copy.text).toContain(
      "The /h/qa-marketplace-test demo site is included on every plan, including Marketplace only, but it is not live for guests.",
    );
    expect(copy.text).toContain("The 14 days to add a card ended");
    expect(copy.text).toContain(
      `Select ${SUBSCRIBE_CHECKOUT_LABEL} to show them again.`,
    );
    expect(copy.text).toContain("Find a Place");
    expect(copy.text).not.toMatch(/\bfree\b/i);
    expect(copy.text).not.toMatch(/you can build it without upgrading/i);
    expect(copy.text).not.toMatch(/guests use the demo/i);
  });

  it("does not hide self-hosted brands even if a suspension date is present", () => {
    expect(
      adminBrandDemoSiteCopy({ ...hidden, hostingMode: "SELF" }).hidden,
    ).toBe(false);
  });
});

describe("K2 admin brand and guest-site wiring", () => {
  it("renders the status copy on /admin/brand and offers a signed-in preview when hidden", () => {
    const page = src("src/app/admin/brand/page.tsx");
    expect(page).toContain("adminBrandDemoSiteCopy");
    expect(page).toContain("demoSiteCopy.hidden");
    expect(page).toContain("preview the site while you are signed in");
    expect(page).toContain("href={previewPath}");
    expect(page).not.toContain("A branded demo site at");
    expect(page).not.toMatch(/\bfree\b/i);
  });

  it("does not bypass the card-window hide on public /h/ routes", () => {
    const host = src("src/lib/host.ts");
    expect(host).toContain("marketplaceSuspendedAt != null");
    expect(host).toContain("return null");
    expect(src("src/app/h/[hostSlug]/page.tsx")).toContain("getHostForGuestSite");
    expect(src("src/app/h/[hostSlug]/page.tsx")).toContain("if (!host) notFound()");
  });

  it("tells hosts the hidden banner also covers the /h/ demo", () => {
    const banner = src("src/components/marketplace-card-banner.tsx").replace(/\s+/g, " ");
    expect(banner).toContain("or open the /h/ demo site");
    expect(banner).toContain("listings and demo again");
    expect(banner).not.toMatch(/\bfree\b/i);
  });
});
