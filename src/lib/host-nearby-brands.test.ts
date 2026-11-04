import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: { property: { findMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => db);

import { getNearbyMarketplaceListings, nearbyBrandAllowed } from "./host";

type Presence = "STAYLOCAL" | "CUSTOM" | "BOTH";
const stay = (id: string, hostId: string, sitePresence: Presence, miles = 1) => ({
  id,
  slug: id,
  title: id,
  hostId,
  city: "Log Cabin",
  region: "Texas",
  latitude: 32.2 + miles / 69,
  longitude: -96.0,
  images: [],
  host: { id: hostId, name: hostId, slug: hostId, listOnMarketplace: true, active: true, sitePresence },
});

describe("nearbyBrandAllowed (T51)", () => {
  it("keeps the same brand even when it has its own site", () => {
    expect(nearbyBrandAllowed("cherokee", stay("a", "cherokee", "BOTH"))).toBe(true);
  });
  it("keeps marketplace-only brands", () => {
    expect(nearbyBrandAllowed("hugh", stay("a", "other", "STAYLOCAL"))).toBe(true);
  });
  it("leaves out another brand that has its own branded site (CUSTOM or BOTH)", () => {
    expect(nearbyBrandAllowed("hugh", stay("a", "cherokee", "BOTH"))).toBe(false);
    expect(nearbyBrandAllowed("hugh", stay("a", "resort", "CUSTOM"))).toBe(false);
  });
  it("without an origin brand, only marketplace-only brands show", () => {
    expect(nearbyBrandAllowed(undefined, stay("a", "cherokee", "BOTH"))).toBe(false);
    expect(nearbyBrandAllowed(null, stay("a", "x", "STAYLOCAL"))).toBe(true);
  });
});

describe("getNearbyMarketplaceListings brand rule (T51)", () => {
  beforeEach(() => db.prisma.property.findMany.mockReset());

  const cherokeeStays = [
    "back-eagles-nest",
    "lower-eagles-nest",
    "kitchenette-1",
    "kitchenette-2",
    "motel-room-1",
    "motel-room-2",
  ].map((id, i) => stay(id, "cherokee", "BOTH", i + 1));

  it("an independent host's lakefront page shows none of Cherokee Landing's 6 stays", async () => {
    db.prisma.property.findMany.mockResolvedValue([
      ...cherokeeStays,
      stay("other-local-cabin", "someone", "STAYLOCAL", 3),
    ]);
    const out = await getNearbyMarketplaceListings(
      { id: "lakefront", hostId: "hugh", latitude: 32.2, longitude: -96.0, city: "Log Cabin", region: "Texas" },
      6,
    );
    expect(out.map((p) => p.slug)).toEqual(["other-local-cabin"]);
  });

  it("a Cherokee Landing page still shows its own stays (no change to their listings)", async () => {
    db.prisma.property.findMany.mockResolvedValue(cherokeeStays.slice(1));
    const out = await getNearbyMarketplaceListings(
      { id: "back-eagles-nest", hostId: "cherokee", latitude: 32.2, longitude: -96.0, city: "Log Cabin", region: "Texas" },
      6,
    );
    expect(out).toHaveLength(5);
  });

  it("asks the DB for host sitePresence", async () => {
    db.prisma.property.findMany.mockResolvedValue([]);
    await getNearbyMarketplaceListings(
      { id: "x", hostId: "h", latitude: null, longitude: null, city: null, region: null },
    );
    expect(db.prisma.property.findMany.mock.calls[0][0].include.host.select).toMatchObject({
      sitePresence: true,
    });
  });
});
