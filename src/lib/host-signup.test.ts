import { describe, expect, it } from "vitest";
import {
  hostRecordName,
  signupNeedsBrandFields,
} from "@/lib/host-signup";

describe("signupNeedsBrandFields", () => {
  it("skips brand fields for marketplace-only paid hosting", () => {
    expect(
      signupNeedsBrandFields({
        hostingMode: "PLATFORM",
        sitePresence: "STAYLOCAL",
      }),
    ).toBe(false);
  });

  it("asks for brand fields on a branded website or self-host", () => {
    expect(
      signupNeedsBrandFields({
        hostingMode: "PLATFORM",
        sitePresence: "BOTH",
      }),
    ).toBe(true);
    expect(
      signupNeedsBrandFields({
        hostingMode: "SELF",
        sitePresence: "CUSTOM",
      }),
    ).toBe(true);
  });
});

describe("hostRecordName", () => {
  it("uses the person's name for marketplace when no brand is given", () => {
    expect(
      hostRecordName({
        personalName: "Hugh Roberts",
        brandName: "",
        needsBrand: false,
      }),
    ).toBe("Hugh Roberts");
  });

  it("requires the brand name for a website", () => {
    expect(
      hostRecordName({
        personalName: "Hugh Roberts",
        brandName: "Lakeside Cabins",
        needsBrand: true,
      }),
    ).toBe("Lakeside Cabins");
    expect(
      hostRecordName({
        personalName: "Hugh Roberts",
        brandName: "  ",
        needsBrand: true,
      }),
    ).toBe("");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIRST_LISTING_PATH,
  PLATFORM_SIGNUP_PLAN_SLUG,
  firstListingPathAfterSignup,
  signupChoseBrandedDemo,
} from "@/lib/host-signup";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("platform signup plan (K1-c)", () => {
  it("starts paid hosts on Marketplace only", () => {
    expect(PLATFORM_SIGNUP_PLAN_SLUG).toBe("marketplace");
  });

  it("keeps branded-website intent as a later domain hint", () => {
    expect(
      signupChoseBrandedDemo({
        hostingMode: "PLATFORM",
        sitePresence: "BOTH",
      }),
    ).toBe(true);
    expect(
      signupChoseBrandedDemo({
        hostingMode: "PLATFORM",
        sitePresence: "CUSTOM",
      }),
    ).toBe(true);
    expect(
      signupChoseBrandedDemo({
        hostingMode: "PLATFORM",
        sitePresence: "STAYLOCAL",
      }),
    ).toBe(false);
    expect(
      signupChoseBrandedDemo({
        hostingMode: "SELF",
        sitePresence: "CUSTOM",
      }),
    ).toBe(false);
  });

  it("appends a domain hint only when they chose a branded demo", () => {
    expect(firstListingPathAfterSignup()).toBe(FIRST_LISTING_PATH);
    expect(firstListingPathAfterSignup({ domainHint: false })).toBe(
      FIRST_LISTING_PATH,
    );
    expect(firstListingPathAfterSignup({ domainHint: true })).toBe(
      "/admin/properties/new?welcome=1&domainHint=1",
    );
  });

  it("registerHost and startHosting resolve the marketplace plan, not sitePresence", () => {
    const actions = src("app/actions/host.ts");
    expect(actions).toContain("resolvePlatformSignupPlanId");
    expect(actions).not.toContain("planSlugForSitePresence");
    expect(actions.match(/await resolvePlatformSignupPlanId\(\)/g)?.length).toBe(
      2,
    );
    expect(actions).toContain("firstListingPathAfterSignup({ domainHint })");
    const helper = src("lib/host-signup.ts");
    expect(helper).toContain("slug: PLATFORM_SIGNUP_PLAN_SLUG");
    expect(helper).not.toMatch(
      /findFirst\(\s*\{\s*where:\s*\{\s*isActive:\s*true,\s*monthlyPrice/,
    );
  });

  it("signup form does not submit a branded planId", () => {
    const form = src("components/HostSignupForm.tsx");
    expect(form).not.toMatch(/formData\.set\(\s*["']planId["']/);
    expect(form).not.toMatch(/name=["']planId["']/);
    expect(form).toContain("Branded website · ${brandedPrice}");
    expect(form).toContain(
      "The Branded website plan is charged when you connect a custom domain",
    );
  });

  it("first listing page can prompt to connect a domain later", () => {
    const page = src("app/admin/properties/new/page.tsx");
    expect(page).toContain("domainHint");
    expect(page).toContain("/admin/brand#domain-setup");
    expect(page).toContain("brandedPriceLabel()");
  });
});
