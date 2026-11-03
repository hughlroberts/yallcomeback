import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isListingSetupPath, LISTING_SETUP_EXIT_HREF, LISTING_SETUP_EXIT_LABEL } from "./listing-setup-path";
import { BrandLogo } from "@/components/brand-logo";

describe("listing setup header logo (T35)", () => {
  it("matches only listing wizard pages", () => {
    expect(isListingSetupPath("/admin/properties/abc/setup")).toBe(true);
    expect(isListingSetupPath("/admin/properties/abc/setup?step=3")).toBe(true);
    for (const p of ["/admin/properties", "/admin/properties/abc", "/admin/properties/new", "/", null]) {
      expect(isListingSetupPath(p)).toBe(false);
    }
  });

  it("in setup the logo is named Exit setup, not a second Back link", () => {
    const html = renderToStaticMarkup(
      createElement(BrandLogo, { href: LISTING_SETUP_EXIT_HREF, label: LISTING_SETUP_EXIT_LABEL }),
    );
    expect(html).toContain('aria-label="Exit setup"');
    expect(html).toContain('href="/admin/properties"');
    expect(html).not.toMatch(/aria-label="[^"]*Back/);
  });

  it("outside setup the logo keeps its home label", () => {
    const html = renderToStaticMarkup(createElement(BrandLogo));
    expect(html).toContain('aria-label="Yall Come Back, home"');
    expect(html).toContain('href="/"');
  });
});
