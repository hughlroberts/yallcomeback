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
});
