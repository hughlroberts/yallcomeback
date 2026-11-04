/**
 * T58: a paused listing (published=false). Direct links show guests the
 * "not available" page; the brand's own host and Platform admins get a
 * preview (with the "Paused, not visible to guests" banner). In-memory
 * listing only; no production data is touched.
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
  if (where.published === false && l.published) return false;
  if (where.archivedAt === null && l.archivedAt != null) return false;
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

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingUnavailable } from "@/components/listing-unavailable";
import { PausedListingBanner } from "@/components/paused-listing-banner";
import { pausedListingAccess, PAUSED_PREVIEW_BANNER } from "@/lib/brand-visibility";

function seed() {
  store.host = { id: "h_qa", slug: "qa-tester-two", name: "QA Tester Two", active: true, listOnMarketplace: true, hostingMode: "PLATFORM", sitePresence: "STAYLOCAL", approvalStatus: "APPROVED", subscriptionStatus: "ACTIVE", sitePublishState: "LIVE", marketplaceSuspendedAt: null };
  store.listing = { id: "p_qa", slug: "qa-test-listing-do-not-book", hostId: "h_qa", published: false, archivedAt: null, listOnMarketplace: true, maxGuests: 4 };
  store.session = null;
}
const asGuest = () => (store.session = { user: { id: "u_guest", role: "GUEST" } });
const asOwnHost = () => (store.session = { user: { id: "u_host", role: "HOST", hostId: "h_qa" } });
const asOtherHost = () => (store.session = { user: { id: "u_other", role: "HOST", hostId: "h_other" } });
const asAdmin = () => (store.session = { user: { id: "u_admin", role: "ADMIN" } });

async function marketplacePage(sp: Record<string, string> = {}) {
  const { default: Page } = await import("@/app/marketplace/properties/[slug]/page");
  return Page({ params: Promise.resolve({ slug: "qa-test-listing-do-not-book" }), searchParams: Promise.resolve(sp) });
}
async function hostSitePage() {
  const { default: Page } = await import("@/app/h/[hostSlug]/properties/[slug]/page");
  return Page({ params: Promise.resolve({ hostSlug: "qa-tester-two", slug: "qa-test-listing-do-not-book" }) });
}
const isUnavailable = (el: unknown) =>
  Boolean(el && typeof el === "object" && (el as { type?: unknown }).type === ListingUnavailable);

beforeEach(() => {
  vi.clearAllMocks();
  seed();
});

describe("paused listing: guests see 'not available'", () => {
  for (const [who, login] of [["signed out", () => {}], ["a guest", asGuest], ["another brand's host", asOtherHost]] as const) {
    it(`marketplace link and /h/ link for ${who}`, async () => {
      login();
      expect(isUnavailable(await marketplacePage({ host: "qa-tester-two" }))).toBe(true);
      expect(isUnavailable(await marketplacePage())).toBe(true);
      expect(isUnavailable(await hostSitePage())).toBe(true);
    });
  }

  it("archived listings stay a plain 404", async () => {
    store.listing.archivedAt = new Date();
    await expect(marketplacePage({ host: "qa-tester-two" })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("paused listing: the host (and admin) can preview", () => {
  it("own host gets a preview, not the guest page", async () => {
    asOwnHost();
    expect(await pausedListingAccess("qa-test-listing-do-not-book", "qa-tester-two")).toEqual({
      kind: "preview",
      id: "p_qa",
      hostSlug: "qa-tester-two",
    });
  });

  it("admin gets a preview", async () => {
    asAdmin();
    expect((await pausedListingAccess("qa-test-listing-do-not-book"))?.kind).toBe("preview");
  });

  it("own host: /h/ website link goes on to the listing page preview", async () => {
    asOwnHost();
    await expect(hostSitePage()).rejects.toMatchObject({
      url: "/marketplace/properties/qa-test-listing-do-not-book?host=qa-tester-two",
    });
  });

  it("signed preview token works with NO session (new tab without cookie)", async () => {
    process.env.AUTH_SECRET ||= "test-only-secret-not-real-0123456789";
    const { createListingPreviewToken } = await import("@/lib/listing-preview-token");
    store.session = null as never;
    const t = createListingPreviewToken("p_qa");
    expect(await pausedListingAccess("qa-test-listing-do-not-book", "qa-tester-two", t)).toEqual({
      kind: "preview",
      id: "p_qa",
      hostSlug: "qa-tester-two",
    });
    // wrong listing's token, or junk: still "not available" for guests
    const other = createListingPreviewToken("p_other");
    expect((await pausedListingAccess("qa-test-listing-do-not-book", "qa-tester-two", other))?.kind).toBe("unavailable");
    expect((await pausedListingAccess("qa-test-listing-do-not-book", "qa-tester-two", "1.x"))?.kind).toBe("unavailable");
    // /h/ link carries the token through its redirect
    const { default: Page } = await import("@/app/h/[hostSlug]/properties/[slug]/page");
    await expect(
      Page({
        params: Promise.resolve({ hostSlug: "qa-tester-two", slug: "qa-test-listing-do-not-book" }),
        searchParams: Promise.resolve({ preview: t }),
      }),
    ).rejects.toMatchObject({
      url: `/marketplace/properties/qa-test-listing-do-not-book?host=qa-tester-two&preview=${encodeURIComponent(t)}`,
    });
  });

  it("published listings are not treated as paused", async () => {
    store.listing.published = true;
    expect(await pausedListingAccess("qa-test-listing-do-not-book", "qa-tester-two")).toBeNull();
  });

  it("the preview banner says it is paused and hidden from guests", () => {
    const html = renderToStaticMarkup(createElement(PausedListingBanner));
    expect(PAUSED_PREVIEW_BANNER).toBe("Paused, not visible to guests");
    expect(html).toContain("Paused, not visible to guests");
  });
});
