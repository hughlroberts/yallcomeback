/**
 * T46(6) follow-up (4a7e51a): a Marketplace brand hidden after its add-card
 * grace ended (marketplaceSuspendedAt set). Runs the real page and action
 * code against an in-memory listing; no production data is touched.
 *
 * - Find a Place leaves the listing out.
 * - Direct links (/marketplace/properties/[slug], ?host=, via=host_site,
 *   /h/[brand]/properties/[slug], /book/[slug]) show "not available".
 * - The brand's own host and Platform admins can still preview.
 * - createBooking refuses new bookings (preview too).
 * - Once paid (suspension cleared) the direct links work again.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Where = Record<string, unknown>;

const store = vi.hoisted(() => ({
  host: {} as Record<string, unknown>,
  listing: {} as Record<string, unknown>,
  session: null as null | { user: { id: string; role: string; hostId?: string | null } },
}));

/** Minimal Prisma-style filter for the host part of the page queries. */
function hostMatches(where: Where | undefined): boolean {
  if (!where) return true;
  const h = store.host;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      if (!(cond as Where[]).some((o) => hostMatches(o))) return false;
      continue;
    }
    const v = h[key];
    if (cond === null) {
      if (v != null) return false;
    } else if (typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { not?: unknown; in?: unknown[]; notIn?: unknown[] };
      if ("not" in c && c.not === null && v == null) return false;
      if (c.in && !c.in.includes(v)) return false;
      if (c.notIn && c.notIn.includes(v)) return false;
    } else if (v !== cond) {
      return false;
    }
  }
  return true;
}

function listingMatches(where: Where): boolean {
  const l = store.listing;
  if ("id" in where && where.id !== l.id) return false;
  if ("slug" in where && where.slug !== l.slug) return false;
  if (where.published === true && !l.published) return false;
  return hostMatches(where.host as Where | undefined);
}

const db = vi.hoisted(() => ({
  prisma: {
    property: {
      findFirst: vi.fn(async ({ where }: { where: Where }) =>
        listingMatches(where) ? { ...store.listing, host: { ...store.host } } : null,
      ),
      findUnique: vi.fn(async ({ where }: { where: Where }) =>
        where.id === store.listing.id ? { ...store.listing, seasons: [], host: { ...store.host } } : null,
      ),
      findMany: vi.fn(async () => []),
    },
    host: {
      findFirst: vi.fn(async ({ where }: { where: Where }) =>
        where.slug === store.host.slug ? { ...store.host } : null,
      ),
    },
    user: { findUnique: vi.fn(async () => null) },
  },
}));
const authMock = vi.hoisted(() => ({ auth: vi.fn(async () => store.session) }));

vi.mock("@/lib/db", () => db);
vi.mock("./db", () => db);
vi.mock("@/lib/auth", () => authMock);
vi.mock("./auth", () => authMock);
vi.mock("@/lib/tenant", () => ({ getRequestTenant: vi.fn(async () => null) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));

import { ListingUnavailable } from "@/components/listing-unavailable";
import { LISTING_UNAVAILABLE_BOOKING_ERROR } from "@/lib/brand-visibility";
import { marketplacePropertyWhere } from "@/lib/host";

const SUSPENDED_AT = new Date("2026-11-01T06:00:00Z");

function seed(suspended: boolean) {
  store.host = {
    id: "h_qa",
    slug: "qa-marketplace-test",
    name: "QA Marketplace Test",
    active: true,
    listOnMarketplace: true,
    hostingMode: "PLATFORM",
    sitePresence: "STAYLOCAL",
    approvalStatus: "APPROVED",
    subscriptionStatus: "ACTIVE",
    sitePublishState: "LIVE",
    marketplaceSuspendedAt: suspended ? SUSPENDED_AT : null,
  };
  store.listing = {
    id: "p_qa",
    slug: "qa-cabin",
    hostId: "h_qa",
    published: true,
    archivedAt: null,
    listOnMarketplace: true,
    maxGuests: 4,
  };
  store.session = null;
}

const asGuest = () => (store.session = { user: { id: "u_guest", role: "GUEST" } });
const asOwnHost = () => (store.session = { user: { id: "u_host", role: "HOST", hostId: "h_qa" } });
const asOtherHost = () => (store.session = { user: { id: "u_other", role: "HOST", hostId: "h_other" } });
const asAdmin = () => (store.session = { user: { id: "u_admin", role: "ADMIN" } });

async function marketplacePage(sp: Record<string, string> = {}) {
  const { default: Page } = await import("@/app/marketplace/properties/[slug]/page");
  return Page({ params: Promise.resolve({ slug: "qa-cabin" }), searchParams: Promise.resolve(sp) });
}
async function hostSitePage() {
  const { default: Page } = await import("@/app/h/[hostSlug]/properties/[slug]/page");
  return Page({ params: Promise.resolve({ hostSlug: "qa-marketplace-test", slug: "qa-cabin" }) });
}
async function bookPage(sp: Record<string, string> = {}) {
  const { default: Page } = await import("@/app/book/[slug]/page");
  return Page({ params: Promise.resolve({ slug: "qa-cabin" }), searchParams: Promise.resolve(sp) });
}

const isUnavailable = (el: unknown) =>
  Boolean(el && typeof el === "object" && (el as { type?: unknown }).type === ListingUnavailable);

beforeEach(() => {
  vi.clearAllMocks();
  seed(true);
});

describe("Find a Place search for a hidden brand", () => {
  it("the search filter does not match the hidden brand, and matches it again once paid", () => {
    const where = marketplacePropertyWhere();
    expect(hostMatches(where.host as Where)).toBe(false);
    seed(false);
    expect(hostMatches(where.host as Where)).toBe(true);
  });
});

describe("direct listing links for a hidden brand (signed out / guest / other brand)", () => {
  for (const [who, login] of [
    ["signed out", () => {}],
    ["a guest", asGuest],
    ["another brand's host", asOtherHost],
  ] as const) {
    it(`/marketplace/properties/qa-cabin: not available for ${who}`, async () => {
      login();
      expect(isUnavailable(await marketplacePage())).toBe(true);
    });
  }

  it("?host=qa-marketplace-test link: not available", async () => {
    expect(isUnavailable(await marketplacePage({ host: "qa-marketplace-test" }))).toBe(true);
  });

  it("host-site link (via=host_site, which skips the search filter): not available", async () => {
    expect(
      isUnavailable(await marketplacePage({ host: "qa-marketplace-test", via: "host_site" })),
    ).toBe(true);
  });

  it("/h/qa-marketplace-test/properties/qa-cabin: not available (no redirect into the listing)", async () => {
    expect(isUnavailable(await hostSitePage())).toBe(true);
  });

  it("/book/qa-cabin: not available", async () => {
    expect(isUnavailable(await bookPage({ checkIn: "2026-12-01", checkOut: "2026-12-03" }))).toBe(true);
  });

  it("an unknown slug is still a normal 404, not the hidden page", async () => {
    store.listing.slug = "other";
    await expect(marketplacePage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("preview for the brand's own host and Platform admins", () => {
  it("own host: /h/ link renders the listing inline, not the hidden page", async () => {
    asOwnHost();
    const el = await hostSitePage();
    const { default: ListingPage } = await import("@/app/marketplace/properties/[slug]/page");
    expect(el.type).toBe(ListingPage);
  });

  it("admin: /h/ link goes on to the listing too", async () => {
    asAdmin();
    expect(isUnavailable(await hostSitePage())).toBe(false);
  });
});

describe("new bookings for a hidden brand", () => {
  function bookingForm() {
    const fd = new FormData();
    for (const [k, v] of Object.entries({
      propertyId: "p_qa",
      checkIn: "2026-12-01",
      checkOut: "2026-12-03",
      guests: "2",
      guestName: "Pat Guest",
      guestEmail: "pat@example.com",
      guestPhone: "5125550100",
    }))
      fd.set(k, v);
    return fd;
  }

  it("createBooking refuses with the not-available message", async () => {
    const { createBooking } = await import("@/app/actions/bookings");
    await expect(createBooking(bookingForm())).rejects.toThrow(LISTING_UNAVAILABLE_BOOKING_ERROR);
  });

  it("refused even while the host previews (no bookings on a hidden brand)", async () => {
    asOwnHost();
    const { createBooking } = await import("@/app/actions/bookings");
    await expect(createBooking(bookingForm())).rejects.toThrow(LISTING_UNAVAILABLE_BOOKING_ERROR);
  });

  it("cannot book a foreign brand from a branded guest route", async () => {
    seed(false);
    const { getRequestTenant } = await import("@/lib/tenant");
    vi.mocked(getRequestTenant).mockResolvedValueOnce({ slug: "other-brand" } as never);
    const { createBooking } = await import("@/app/actions/bookings");
    await expect(createBooking(bookingForm())).rejects.toThrow("This stay is not available on this host site.");
  });

  it("once paid, createBooking gets past the hidden-brand check", async () => {
    seed(false);
    const { createBooking } = await import("@/app/actions/bookings");
    await expect(createBooking(bookingForm())).rejects.not.toThrow(LISTING_UNAVAILABLE_BOOKING_ERROR);
  });
});

describe("after payment clears the suspension", () => {
  it("/h/ link goes to the listing again for the public", async () => {
    seed(false);
    const el = await hostSitePage();
    const { default: ListingPage } = await import("@/app/marketplace/properties/[slug]/page");
    expect(el.type).toBe(ListingPage);
  });
});
