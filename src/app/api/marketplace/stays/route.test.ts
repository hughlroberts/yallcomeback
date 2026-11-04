import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const host = vi.hoisted(() => ({ searchMarketplace: vi.fn() }));
vi.mock("@/lib/host", () => host);
vi.mock("@/lib/marketplace-slugs", () => ({
  ambiguousMarketplaceSlugs: vi.fn(async () => new Set()),
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { GET } from "./route";

const get = (q: string) =>
  GET(
    new NextRequest(`https://www.yallcomeback.app/api/marketplace/stays?${q}`),
  );
const ymd = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 86400_000).toISOString().slice(0, 10);

describe("GET /api/marketplace/stays", () => {
  beforeEach(() => {
    host.searchMarketplace.mockReset();
    host.searchMarketplace.mockResolvedValue({
      listings: [],
      total: 9,
      flexibleDates: null,
    });
  });

  it("400s past and inverted dates", async () => {
    const past = await get(`checkIn=${ymd(-5)}&checkOut=${ymd(-3)}`);
    expect(past.status).toBe(400);
    expect(await past.json()).toMatchObject({ code: "past_dates" });
    const inverted = await get(`checkIn=${ymd(9)}&checkOut=${ymd(7)}`);
    expect(inverted.status).toBe(400);
    expect(await inverted.json()).toMatchObject({
      code: "checkout_not_after_checkin",
    });
    expect(host.searchMarketplace).not.toHaveBeenCalled();
  });

  it("passes filters through and returns the total count", async () => {
    const res = await get(
      `where=Malakoff&checkIn=${ymd(9)}&checkOut=${ymd(11)}&amenities=lake_view`,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).count).toBe(9);
    expect(host.searchMarketplace.mock.calls[0][1]).toMatchObject({
      withTotal: true,
      filters: { amenities: ["lake_view"] },
    });
  });

  const takeOf = (i = 0) => host.searchMarketplace.mock.calls[i][0].take;

  it("honors limit like /api/v1/search: default 20, max 50, take wins", async () => {
    const qs = ["where=Malakoff", "limit=5", "take=7&limit=30", "take=12", "limit=1", "limit=50"];
    for (const q of qs) expect((await get(q)).status, q).toBe(200);
    expect(qs.map((_, i) => takeOf(i))).toEqual([20, 5, 7, 12, 1, 50]);
  });

  it("returns 400 invalid_limit like /api/v1/search (T53)", async () => {
    for (const q of ["limit=2.5", "limit=1e1", "limit=abc", "limit=0", "limit=-4", "limit=500", "take=0"]) {
      const res = await get(q);
      expect(res.status, q).toBe(400);
      expect(await res.json(), q).toMatchObject({ ok: false, code: "invalid_limit" });
    }
    expect(host.searchMarketplace).not.toHaveBeenCalled();
  });

  it("returns 400 invalid_guests / invalid_pets for junk party values (T54)", async () => {
    for (const q of ["guests=-5", "guests=abc", "guests=2.5"]) {
      const res = await get(q);
      expect(res.status, q).toBe(400);
      expect(await res.json(), q).toMatchObject({ code: "invalid_guests" });
    }
    for (const q of ["pets=abc", "pets=-1", "pets=1.5", "pets=5", "pets=99"]) {
      const res = await get(q);
      expect(res.status, q).toBe(400);
      const body = await res.json();
      expect(body, q).toMatchObject({ code: "invalid_pets" });
      if (q === "pets=5") expect(JSON.stringify(body)).toContain("0 to 4");
    }
    expect(host.searchMarketplace).not.toHaveBeenCalled();
    await get("guests=6&pets=1");
    expect(host.searchMarketplace.mock.calls[0][0]).toMatchObject({ guests: 6, pets: 1 });
    await get("guests=6&pets=4");
    expect(host.searchMarketplace.mock.calls[1][0]).toMatchObject({ guests: 6, pets: 4 });
  });

  it("returns count (full total), returned and currentCount", async () => {
    const listing = {
      id: "p1",
      slug: "lake-house",
      title: "Lake house",
      tagline: null,
      city: "Malakoff",
      region: "TX",
      baseNightlyRate: 150,
      maxGuests: 6,
      bedrooms: 3,
      bathrooms: 2,
      images: [],
      host: null,
    };
    host.searchMarketplace.mockResolvedValueOnce({
      listings: [listing, { ...listing, id: "p2", slug: "cabin" }],
      total: 31,
      flexibleDates: null,
    });
    const body = await (await get("limit=2")).json();
    expect(body).toMatchObject({ count: 31, returned: 2, currentCount: 31 });
    expect(body.listings).toHaveLength(2);

    host.searchMarketplace.mockResolvedValueOnce({
      listings: [],
      total: 4,
      flexibleDates: { currentCount: 4, suggestions: [] },
    });
    const exact = await (
      await get(`checkIn=${ymd(9)}&checkOut=${ymd(11)}&limit=10`)
    ).json();
    expect(exact).toMatchObject({ count: 4, returned: 0, currentCount: 4 });
    expect(exact.flexibleDates.currentCount).toBe(exact.count);
  });
});
