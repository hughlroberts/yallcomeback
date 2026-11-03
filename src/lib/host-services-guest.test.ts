import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const db = vi.hoisted(() => ({ prisma: { host: { findFirst: vi.fn() } } }));
const auth = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/auth", () => auth);

import { getHostForGuestServicesPage, getHostForGuestSite } from "./host";
import {
  isServicesPagePath,
  servicesOnlyGuestAllowed,
  servicesOverrideBadgeLabel,
} from "./services-access";
import { HostSiteHeader } from "@/components/host-site-header";

// Marketplace-only brand: site not published, approved, paying.
const host = {
  id: "h_mq",
  slug: "mq",
  name: "Mountain Quiet",
  logoUrl: null,
  tagline: null,
  active: true,
  approvalStatus: "APPROVED",
  subscriptionStatus: "ACTIVE",
  hostingMode: "PLATFORM",
  sitePresence: "STAYLOCAL",
  sitePublishState: "UNPUBLISHED",
  sitePageAbout: true,
  sitePageServices: true,
  servicesOverride: true,
  siteServicesTitle: "Boat rentals",
  siteServicesPath: "boat-rentals",
};

describe("guest access to the Services page only (override brands)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.auth.mockResolvedValue(null); // guest, not signed in
  });

  it("guest can open Services when the override is on", async () => {
    db.prisma.host.findFirst.mockResolvedValue(host);
    const r = await getHostForGuestServicesPage("mq");
    expect(r?.servicesOnly).toBe(true);
    expect(r?.host.id).toBe("h_mq");
  });

  it("guest still cannot open the rest of the brand (home, stays, about use the site gate)", async () => {
    db.prisma.host.findFirst.mockResolvedValue(host);
    await expect(getHostForGuestSite("mq")).resolves.toBeNull();
  });

  it("404 for guests when the override is off, Services is off, or the brand is not live", async () => {
    for (const h of [
      { ...host, servicesOverride: false },
      { ...host, sitePageServices: false },
      { ...host, approvalStatus: "PENDING_REVIEW" },
      { ...host, subscriptionStatus: "NONE" },
      { ...host, active: false },
    ]) {
      db.prisma.host.findFirst.mockResolvedValue(h);
      await expect(getHostForGuestServicesPage("mq")).resolves.toBeNull();
    }
  });

  it("published brands use the normal site gate (not services-only)", async () => {
    db.prisma.host.findFirst.mockResolvedValue({
      ...host,
      sitePresence: "BOTH",
      sitePublishState: "LIVE",
    });
    const r = await getHostForGuestServicesPage("mq");
    expect(r?.servicesOnly).toBe(false);
  });

  it("services-only chrome applies only on the Services path", () => {
    expect(isServicesPagePath("/h/mq/services", "/h/mq", "boat-rentals")).toBe(true);
    expect(isServicesPagePath("/h/mq/boat-rentals/", "/h/mq", "boat-rentals")).toBe(true);
    expect(isServicesPagePath("/boat-rentals", "", "boat-rentals")).toBe(true);
    for (const p of ["/h/mq", "/h/mq/stays", "/h/mq/about", "/h/other/services", "/about"]) {
      expect(isServicesPagePath(p, p.startsWith("/h/") ? "/h/mq" : "", "boat-rentals")).toBe(false);
    }
    expect(servicesOnlyGuestAllowed(host as never, false)).toBe(false);
  });

  it("services-only header links only to Services (no Home, Stays or About)", () => {
    const html = renderToStaticMarkup(
      createElement(HostSiteHeader, { host: host as never, basePath: "/h/mq", servicesOnly: true }),
    );
    expect(html).toContain('href="/h/mq/boat-rentals"');
    expect(html).not.toMatch(/href="\/h\/mq"/);
    expect(html).not.toContain("/h/mq/stays");
    expect(html).not.toContain("/h/mq/about");
    expect(html).not.toContain(">Home<");
  });
});

describe("services override badge", () => {
  it("shows only when the override is on", () => {
    expect(servicesOverrideBadgeLabel({ ...host, servicesOverride: true } as never)).toBe(
      "Services override",
    );
    expect(servicesOverrideBadgeLabel({ ...host, servicesOverride: false } as never)).toBeNull();
  });
});

describe("services-only page body", () => {
  it("hides buttons that link to other brand pages, keeps outside links", async () => {
    const { ServicesPageRenderer, isBrandSiteHref } = await import(
      "@/components/services-page-renderer"
    );
    expect(isBrandSiteHref("/about#contact")).toBe(true);
    expect(isBrandSiteHref("https://example.com")).toBe(false);
    const blocks = [
      { id: "a", type: "button", content: "Contact", secondary: "/about#contact" },
      { id: "b", type: "button", content: "Call", secondary: "tel:5551234" },
    ] as never;
    const shown = renderToStaticMarkup(
      createElement(ServicesPageRenderer, { blocks, basePath: "/h/mq", hideSiteLinks: true }),
    );
    expect(shown).not.toContain("/h/mq/about");
    expect(shown).toContain("tel:5551234");
    const normal = renderToStaticMarkup(
      createElement(ServicesPageRenderer, { blocks, basePath: "/h/mq" }),
    );
    expect(normal).toContain("/h/mq/about#contact");
  });
});
