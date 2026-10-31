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
});
