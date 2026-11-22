import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    property: { findFirst: vi.fn() },
    host: { findFirst: vi.fn() },
  },
}));
const authMock = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => db);
vi.mock("./db", () => db);
vi.mock("@/lib/auth", () => authMock);
vi.mock("./auth", () => authMock);

import {
  brandListingsHidden,
  findHiddenBrandListing,
  hiddenFromViewer,
  viewerCanPreviewBrand,
} from "./brand-visibility";
import { getHostForGuestSite, marketplacePropertyWhere } from "./host";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const hidden = {
  id: "h1",
  hostingMode: "PLATFORM",
  marketplaceSuspendedAt: new Date("2026-11-01T00:00:00Z"),
};

describe("brandListingsHidden", () => {
  it("hides a PLATFORM brand after grace ends", () => {
    expect(brandListingsHidden(hidden)).toBe(true);
  });
  it("shows again once payment clears the suspension", () => {
    expect(brandListingsHidden({ ...hidden, marketplaceSuspendedAt: null })).toBe(false);
  });
  it("never hides self-hosted brands", () => {
    expect(brandListingsHidden({ ...hidden, hostingMode: "SELF" })).toBe(false);
  });
  it("handles a missing host", () => {
    expect(brandListingsHidden(null)).toBe(false);
  });
});

describe("viewerCanPreviewBrand", () => {
  it("lets admins and the brand's own users preview", () => {
    expect(viewerCanPreviewBrand({ role: "ADMIN" }, "h1")).toBe(true);
    expect(viewerCanPreviewBrand({ role: "HOST", hostId: "h1" }, "h1")).toBe(true);
  });
  it("blocks guests, signed-out visitors and other brands", () => {
    expect(viewerCanPreviewBrand(null, "h1")).toBe(false);
    expect(viewerCanPreviewBrand({ role: "GUEST" }, "h1")).toBe(false);
    expect(viewerCanPreviewBrand({ role: "HOST", hostId: "h2" }, "h1")).toBe(false);
  });
});

describe("hiddenFromViewer", () => {
  beforeEach(() => authMock.auth.mockReset());
  it("hides from the public", async () => {
    authMock.auth.mockResolvedValue(null);
    expect(await hiddenFromViewer(hidden)).toBe(true);
  });
  it("allows host preview", async () => {
    authMock.auth.mockResolvedValue({ user: { role: "HOST", hostId: "h1" } });
    expect(await hiddenFromViewer(hidden)).toBe(false);
  });
  it("never hides a paid brand", async () => {
    authMock.auth.mockResolvedValue(null);
    expect(await hiddenFromViewer({ ...hidden, marketplaceSuspendedAt: null })).toBe(false);
  });
});

describe("findHiddenBrandListing", () => {
  it("only matches suspended PLATFORM brands", async () => {
    db.prisma.property.findFirst.mockResolvedValue(null);
    await findHiddenBrandListing("cabin", "brand");
    const where = db.prisma.property.findFirst.mock.calls[0][0].where;
    expect(where.host).toMatchObject({
      hostingMode: "PLATFORM",
      marketplaceSuspendedAt: { not: null },
      slug: "brand",
    });
    expect(where.published).toBe(true);
  });
});

describe("getHostForGuestSite on a hidden brand", () => {
  const host = {
    ...hidden,
    slug: "brand",
    active: true,
    approvalStatus: "APPROVED",
    subscriptionStatus: "ACTIVE",
    sitePublishState: "LIVE",
  };
  beforeEach(() => {
    authMock.auth.mockReset();
    db.prisma.host.findFirst.mockResolvedValue(host);
  });
  it("returns null for the public", async () => {
    authMock.auth.mockResolvedValue(null);
    expect(await getHostForGuestSite("brand")).toBeNull();
  });
  it("returns the host for its own user and admins", async () => {
    authMock.auth.mockResolvedValue({ user: { role: "HOST", hostId: "h1" } });
    expect(await getHostForGuestSite("brand")).toBe(host);
    authMock.auth.mockResolvedValue({ user: { role: "ADMIN" } });
    expect(await getHostForGuestSite("brand")).toBe(host);
  });
  it("returns the host once payment clears the suspension", async () => {
    authMock.auth.mockResolvedValue(null);
    db.prisma.host.findFirst.mockResolvedValue({ ...host, marketplaceSuspendedAt: null });
    expect(await getHostForGuestSite("brand")).not.toBeNull();
  });
});

describe("direct links, booking and API wiring", () => {
  it("search and agent APIs exclude hidden brands", () => {
    const where = marketplacePropertyWhere();
    const platform = where.host.OR.find((o) => o.hostingMode === "PLATFORM");
    expect(platform).toMatchObject({ marketplaceSuspendedAt: null });
    for (const f of ["src/lib/agent/listing.ts", "src/lib/agent/checkout.ts"]) {
      expect(src(f)).toContain("marketplacePropertyWhere()");
    }
  });
  it("listing, host-site and book pages show the clean page", () => {
    for (const f of [
      "src/app/marketplace/properties/[slug]/page.tsx",
      "src/app/h/[hostSlug]/properties/[slug]/page.tsx",
      "src/app/book/[slug]/page.tsx",
    ]) {
      expect(src(f)).toContain("<ListingUnavailable ");
    }
  });
  it("createBooking blocks new bookings for hidden brands", () => {
    const s = src("src/app/actions/bookings.ts");
    expect(s).toContain("brandListingsHidden(property.host)");
    expect(s).toContain("LISTING_UNAVAILABLE_BOOKING_ERROR");
  });
  it("existing booking confirmations stay viewable", () => {
    expect(src("src/app/book/confirmation/[id]/page.tsx")).not.toContain("brand-visibility");
  });
  it("sends no email", () => {
    expect(src("src/lib/brand-visibility.ts")).not.toMatch(/email|resend/i);
  });
});
