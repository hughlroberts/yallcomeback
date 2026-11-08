import { beforeEach, describe, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({ property: { findFirst: vi.fn(), findMany: vi.fn() }, booking: { count: vi.fn(async () => 0) }, user: { findFirst: vi.fn(async () => null) } }));
const discovery = vi.hoisted(() => vi.fn(async () => []));
vi.mock("@/lib/availability", () => ({ getPublicUnavailableRanges: async () => [], expandBlockedDates: () => new Set() }));
vi.mock("@/lib/tenant", () => ({ getRequestTenant: async () => null }));
vi.mock("@/lib/brand-visibility", () => ({ hiddenFromViewer: async () => false, brandListingsHidden: () => false }));
vi.mock("@/lib/marketplace-slugs", () => ({ ambiguousMarketplaceSlugs: async () => new Set() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/host", () => ({
  getNearbyMarketplaceListings: discovery,
  getHostForGuestSite: vi.fn(async () => ({ id: "qa", slug: "qa-host", name: "QA", isTestBrand: true })),
  marketplacePropertyWhere: () => ({ published: true, listOnMarketplace: true, host: { active: true } }),
}));
vi.mock("@/lib/public-image-size", () => ({ publicImageSize: async () => null }));
import ListingPage, { generateMetadata } from "@/app/marketplace/properties/[slug]/page";
const row = { title: "QA stay", slug: "cabin", tagline: "QA", description: "", city: "", region: "", maxGuests: 2, beds: 1, bedrooms: 1, host: { name: "QA" }, images: [] };
beforeEach(() => {
 db.property.findFirst.mockReset().mockResolvedValue(row);
 db.property.findMany.mockReset().mockResolvedValue([]);
 discovery.mockClear();
});
describe("K1 separate canonical documents", () => {
 it("branded canonical and query cannot switch to another host", async () => {
  const meta = await generateMetadata({ params: Promise.resolve({ slug: "cabin", hostSlug: "qa-host" }), searchParams: Promise.resolve({ host: "foreign", via: "marketplace" }) });
  expect(meta.alternates?.canonical).toBe("https://www.yallcomeback.app/h/qa-host/properties/cabin");
  expect(db.property.findFirst.mock.calls[0][0].where).toMatchObject({ published: true, archivedAt: null, host: { slug: "qa-host" } });
  expect(meta.openGraph).toMatchObject({ siteName: "QA" });
 });
 it("marketplace canonical and discovery eligibility remain unchanged", async () => {
  const meta = await generateMetadata({ params: Promise.resolve({ slug: "cabin" }), searchParams: Promise.resolve({}) });
  expect(meta.alternates?.canonical).toBe("https://www.yallcomeback.app/marketplace/properties/cabin");
  expect(db.property.findFirst.mock.calls[0][0].where).toMatchObject({ published: true, listOnMarketplace: true });
 });
});

describe("K1 branded listing rendering", () => {
 it("queries only sibling stays from this host, hides empty nearby, and links to branded booking", async () => {
  db.property.findFirst.mockResolvedValue({ ...row, id: "p1", hostId: "qa", seasons: [], petsAllowed: false, amenities: "[]", host: { id: "qa", slug: "qa-host", name: "QA", taxLines: [], _count: { properties: 1 } } });
  const page = await ListingPage({ params: Promise.resolve({ slug: "cabin", hostSlug: "qa-host" }), searchParams: Promise.resolve({ host: "foreign" }) });
  expect(db.property.findMany.mock.calls[0][0].where).toEqual({ hostId: "qa", published: true, archivedAt: null, id: { not: "p1" } });
  expect(discovery).not.toHaveBeenCalled();
  const elements: { props: Record<string, unknown> }[] = [];
  function walk(node: unknown) {
   if (Array.isArray(node)) return node.forEach(walk);
   if (node && typeof node === "object" && "props" in node) {
    const el = node as { props: Record<string, unknown> };
    elements.push(el);
    walk(el.props.children);
   }
  }
  walk(page);
  expect(elements.find((e) => "bookBasePath" in e.props)?.props.bookBasePath).toBe("/h/qa-host/book/cabin");
  expect(elements.filter((e) => typeof e.props.href === "string").some((e) => String(e.props.href).includes("/marketplace"))).toBe(false);
  expect(elements.some((e) => e.props.children === "More places nearby")).toBe(false);
 });
});
