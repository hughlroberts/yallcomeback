import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  customDomainToPlatformPath,
  planIncludesCustomDomain,
} from "./plan-branded-site";
import { parseDomainMapPayload } from "./custom-domains";

describe("planIncludesCustomDomain (K1-c revised)", () => {
  it("is false on Marketplace only, including when a /h/ demo exists", () => {
    expect(
      planIncludesCustomDomain({
        hostingMode: "PLATFORM",
        plan: { slug: "marketplace" },
      }),
    ).toBe(false);
    expect(
      planIncludesCustomDomain({ hostingMode: "PLATFORM", plan: null }),
    ).toBe(false);
  });

  it("is true on the Branded website plan, complimentary hosted brands, and self-host", () => {
    expect(
      planIncludesCustomDomain({
        hostingMode: "PLATFORM",
        plan: { slug: "branded" },
      }),
    ).toBe(true);
    expect(
      planIncludesCustomDomain({
        hostingMode: "PLATFORM",
        plan: { slug: "complimentary" },
      }),
    ).toBe(true);
    expect(
      planIncludesCustomDomain({ hostingMode: "SELF", plan: null }),
    ).toBe(true);
  });
});

describe("customDomainToPlatformPath", () => {
  it("maps custom-domain guest paths onto the platform /h/<brand>/ demo", () => {
    expect(customDomainToPlatformPath("qa-host", "/")).toBe("/h/qa-host");
    expect(customDomainToPlatformPath("qa-host", "/stays")).toBe("/h/qa-host/stays");
    expect(
      customDomainToPlatformPath("qa-host", "/properties/lake-cabin"),
    ).toBe("/h/qa-host/properties/lake-cabin");
    expect(
      customDomainToPlatformPath("qa-host", "/marketplace/properties/lake-cabin"),
    ).toBe("/h/qa-host/properties/lake-cabin");
    expect(
      customDomainToPlatformPath("qa-host", "/book/lake-cabin"),
    ).toBe("/h/qa-host/book/lake-cabin");
    expect(
      customDomainToPlatformPath("qa-host", "/h/qa-host/about"),
    ).toBe("/h/qa-host/about");
  });
});

describe("parseDomainMapPayload", () => {
  it("reads the { domains, gated } document used by middleware", () => {
    expect(
      parseDomainMapPayload({
        domains: { "qa-brand.test": "qa-host" },
        gated: { "demo.test": "qa-market" },
      }),
    ).toEqual({
      domains: { "qa-brand.test": "qa-host" },
      gated: { "demo.test": "qa-market" },
    });
  });

  it("treats a legacy flat map as all-serveable domains", () => {
    expect(
      parseDomainMapPayload({ "qa-brand.test": "qa-host" }),
    ).toEqual({
      domains: { "qa-brand.test": "qa-host" },
      gated: {},
    });
  });
});

describe("K1-c revised wiring", () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("does not plan-gate public /h/ routes, emails, or the sitemap", () => {
    expect(src("src/lib/host.ts")).not.toContain("planIncludesCustomDomain");
    expect(src("src/lib/host.ts")).not.toContain("planIncludesBrandedSite");
    expect(src("src/app/h/[hostSlug]/page.tsx")).toContain("getHostForGuestSite");
    expect(src("src/app/h/[hostSlug]/page.tsx")).not.toContain("requireBrandedGuestSite");
    expect(src("src/app/h/[hostSlug]/properties/[slug]/page.tsx")).not.toContain(
      "brandedSiteGuestFallbackUrl",
    );
    expect(src("src/lib/booking-emails.ts")).not.toContain("brandedBookingLinkSlug");
    expect(src("src/app/sitemap.ts")).not.toContain("planIncludesCustomDomain");
  });

  it("gates custom domains in admin, profile save, domain-map and middleware", () => {
    expect(src("src/app/admin/brand/page.tsx")).toContain("domainOnPlan");
    expect(src("src/app/admin/brand/page.tsx")).toContain(
      "demo site is included on every plan",
    );
    expect(src("src/app/admin/brand/page.tsx")).toContain("brandedPriceLabel()");
    expect(src("src/app/actions/host.ts")).toContain("upgradeNeedsCheckout = true");
    expect(src("src/app/actions/host.ts")).toContain(
      "Never change planId here",
    );
    expect(src("src/app/api/domain-map/route.ts")).toContain("planIncludesCustomDomain");
    expect(src("src/middleware.ts")).toContain("customDomainToPlatformPath");
    expect(src("src/middleware.ts")).toContain("resolveCustomDomain");
  });
});
