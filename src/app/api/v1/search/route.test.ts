import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextRequest } from "next/server";

const host = vi.hoisted(() => ({ searchMarketplace: vi.fn() }));
vi.mock("@/lib/host", () => host);
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { GET } from "./route";

const get = (q: string) =>
  GET(new NextRequest(`https://www.yallcomeback.app/api/v1/search?${q}`));

const ymd = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 86400_000).toISOString().slice(0, 10);

describe("GET /api/v1/search", () => {
  beforeAll(() => vi.stubEnv("AGENT_API_ENABLED", "true"));
  afterAll(() => vi.unstubAllEnvs());
  beforeEach(() => {
    host.searchMarketplace.mockReset();
    host.searchMarketplace.mockResolvedValue({
      listings: [],
      total: 37,
      flexibleDates: null,
    });
  });

  it("returns 400 past_dates for dates that have passed", async () => {
    const res = await get(
      `location=Malakoff&checkIn=${ymd(-10)}&checkOut=${ymd(-8)}`,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "past_dates" });
    expect(host.searchMarketplace).not.toHaveBeenCalled();
  });

  it("returns 400 for check-out before check-in (not a silent flexible search)", async () => {
    const res = await get(`checkIn=${ymd(20)}&checkOut=${ymd(18)}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      code: "checkout_not_after_checkin",
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("keeps amenities and other filters in humanSearchUrl; count is the uncapped total", async () => {
    const ci = ymd(20);
    const co = ymd(22);
    const res = await get(
      `location=Malakoff&checkIn=${ci}&checkOut=${co}&guests=2&bedrooms=2&maxNightly=300&amenities=lake_view,wifi&take=5`,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(37);
    expect(json.returned).toBe(0);
    const url = new URL(json.humanSearchUrl);
    expect(url.searchParams.get("amenities")).toBe("lake_view,wifi");
    expect(url.searchParams.get("bedrooms")).toBe("2");
    expect(url.searchParams.get("maxNightly")).toBe("300");
    expect(url.searchParams.get("checkIn")).toBe(ci);
    expect(host.searchMarketplace.mock.calls[0][1]).toMatchObject({
      withTotal: true,
      filters: {
        bedrooms: 2,
        maxNightly: 300,
        amenities: ["lake_view", "wifi"],
      },
    });
  });

  it("limit: default 20, max 50, take wins; returns currentCount", async () => {
    for (const q of [
      "",
      "limit=5",
      "limit=500",
      "limit=0",
      "limit=-3",
      "limit=abc",
      "limit=2.5",
      "take=7&limit=30",
    ]) {
      await get(`location=Malakoff&${q}`);
    }
    expect(host.searchMarketplace.mock.calls.map((c) => c[0].take)).toEqual([
      20, 5, 50, 20, 20, 20, 20, 7,
    ]);
    const json = await (await get("location=Malakoff")).json();
    expect(json).toMatchObject({ count: 37, returned: 0, currentCount: 37 });
  });

  it("caps guests at the search max in the query echo, filter and humanSearchUrl", async () => {
    const res = await get("location=Malakoff&guests=99");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query.guests).toBe(50);
    expect(new URL(body.humanSearchUrl).searchParams.get("guests")).toBe("50");
    expect(host.searchMarketplace.mock.calls[0][0]).toMatchObject({
      guests: 50,
    });
  });

  it("keeps a normal party as sent and drops junk guests", async () => {
    const two = await (await get("guests=2")).json();
    expect(two.query.guests).toBe(2);
    expect(new URL(two.humanSearchUrl).searchParams.get("guests")).toBe("2");
    const junk = await (await get("guests=abc")).json();
    expect(junk.query.guests).toBeUndefined();
    expect(new URL(junk.humanSearchUrl).searchParams.has("guests")).toBe(false);
  });
});
