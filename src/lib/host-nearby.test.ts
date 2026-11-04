import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: { property: { findMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => db);

import { getNearbyMarketplaceListings } from "./host";

const stay = (id: string, hostId: string, miles: number) => ({
  id,
  slug: id,
  title: id,
  hostId,
  city: "Log Cabin",
  region: "Texas",
  latitude: 32.2 + miles / 69,
  longitude: -96.0,
  images: [],
  host: { id: hostId, name: hostId, slug: hostId, listOnMarketplace: true, active: true },
});

describe("getNearbyMarketplaceListings (Hugh: every marketplace brand shows)", () => {
  beforeEach(() => db.prisma.property.findMany.mockReset());

  it("shows other brands' marketplace stays, including resort brands with their own site, closest first", async () => {
    db.prisma.property.findMany.mockResolvedValue([
      stay("resort-far", "resort-brand", 5),
      stay("resort-near", "resort-brand", 1),
      stay("indie", "indie-brand", 3),
    ]);
    const out = await getNearbyMarketplaceListings(
      { id: "origin", latitude: 32.2, longitude: -96.0, city: "Log Cabin", region: "Texas" },
      6,
    );
    expect(out.map((p) => p.slug)).toEqual(["resort-near", "indie", "resort-far"]);
    const where = db.prisma.property.findMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: "origin" });
    expect(where.hostId).toBeUndefined();
  });
});
