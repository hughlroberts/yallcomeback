import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  brandedSiteGuestFallback,
  planIncludesBrandedSite,
} from "./plan-branded-site";

describe("planIncludesBrandedSite (K1-c)", () => {
  it("excludes the Marketplace-only plan, including when sitePresence is branded", () => {
    expect(
      planIncludesBrandedSite({
        hostingMode: "PLATFORM",
        plan: { slug: "marketplace" },
      }),
    ).toBe(false);
    expect(
      planIncludesBrandedSite({ hostingMode: "PLATFORM", plan: null }),
    ).toBe(false);
  });

  it("includes the Branded website plan, complimentary hosted brands, and self-host", () => {
    expect(
      planIncludesBrandedSite({
        hostingMode: "PLATFORM",
        plan: { slug: "branded" },
      }),
    ).toBe(true);
    expect(
      planIncludesBrandedSite({
        hostingMode: "PLATFORM",
        plan: { slug: "complimentary" },
      }),
    ).toBe(true);
    expect(
      planIncludesBrandedSite({ hostingMode: "SELF", plan: null }),
    ).toBe(true);
  });
});

describe("brandedSiteGuestFallback (K1-c)", () => {
  it("sends property pages to the marketplace listing so guest links keep working", () => {
    expect(
      brandedSiteGuestFallback("qa-host", "/properties/lake-cabin", {
        checkIn: "2027-06-01",
        checkOut: "2027-06-05",
      }),
    ).toBe(
      "/marketplace/properties/lake-cabin?checkIn=2027-06-01&checkOut=2027-06-05&host=qa-host",
    );
  });

  it("sends branded booking and confirmation to the shared /book routes", () => {
    expect(
      brandedSiteGuestFallback("qa-host", "/book/lake-cabin", {
        checkIn: "2027-06-01",
        checkOut: "2027-06-05",
        guests: "4",
      }),
    ).toBe(
      "/book/lake-cabin?checkIn=2027-06-01&checkOut=2027-06-05&guests=4&host=qa-host",
    );
    expect(
      brandedSiteGuestFallback("qa-host", "/book/confirmation/b1", {
        t: "token",
        cancel: "1",
      }),
    ).toBe("/book/confirmation/b1?t=token&cancel=1");
  });

  it("sends home, stays, legal and help to /marketplace", () => {
    for (const path of ["/", "/stays", "/terms", "/privacy", "/help/cancellation-policies", "/about"]) {
      expect(brandedSiteGuestFallback("qa-host", path)).toBe("/marketplace");
    }
  });
});

describe("K1-c wiring", () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("centralizes entitlement in planIncludesBrandedSite and gates guest /h/ routes", () => {
    expect(src("src/lib/host.ts")).toContain("planIncludesBrandedSite(any)");
    expect(src("src/app/h/[hostSlug]/properties/[slug]/page.tsx")).toContain(
      "brandedSiteGuestFallbackUrl",
    );
    expect(src("src/app/h/[hostSlug]/page.tsx")).toContain("requireBrandedGuestSite");
    expect(src("src/app/book/[slug]/page.tsx")).toContain("redirectIfBrandedSiteGated");
    expect(src("src/lib/booking-emails.ts")).toContain("brandedBookingLinkSlug");
    expect(src("src/app/admin/brand/page.tsx")).toContain("brandedSiteOnPlan");
    expect(src("src/app/sitemap.ts")).toContain("planIncludesBrandedSite(h)");
  });

  it("does not invent new fee copy in the host admin upgrade notice (B7)", () => {
    const brand = src("src/app/admin/brand/page.tsx");
    expect(brand).toContain("brandedPriceLabel()");
    expect(brand).toContain("Branded website plan feature");
  });
});
