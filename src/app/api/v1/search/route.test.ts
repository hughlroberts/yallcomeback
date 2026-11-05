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

  it("returns 400 invalid_date for checkIn=notadate", async () => {
    const res = await get(`checkIn=notadate&checkOut=${ymd(4)}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "invalid_date" });
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

  it("limit: default 20, whole numbers 1-50 used as-is, take wins; returns currentCount", async () => {
    for (const q of ["", "limit=", "limit=5", "limit=50", "take=7&limit=30"]) {
      const res = await get(`location=Malakoff&${q}`);
      expect(res.status).toBe(200);
    }
    expect(host.searchMarketplace.mock.calls.map((c) => c[0].take)).toEqual([
      20, 20, 5, 50, 7,
    ]);
    const json = await (await get("location=Malakoff")).json();
    expect(json).toMatchObject({ count: 37, returned: 0, currentCount: 37 });
  });

  it("returns 400 invalid_limit for non-integer or out-of-range limit/take", async () => {
    for (const q of [
      "limit=2.5",
      "limit=0",
      "limit=-3",
      "limit=51",
      "limit=500",
      "limit=abc",
      "limit=1e1",
      "take=2.5&limit=5",
    ]) {
      const res = await get(`location=Malakoff&${q}`);
      expect(res.status, q).toBe(400);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      const body = await res.json();
      expect(body, q).toMatchObject({ ok: false, code: "invalid_limit" });
      expect(body.error).toMatch(/whole number from 1 to 50/);
    }
    expect(host.searchMarketplace).not.toHaveBeenCalled();
  });

  it("400s guests over the search max instead of clamping (R1104-13)", async () => {
    const res = await get("location=Malakoff&guests=99");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: "invalid_guests" });
    expect(body.error).toContain("1 to 50");
    expect((await get("location=Malakoff&guests=50")).status).toBe(200);
  });

  it("400s bad price range, flexibility, lone dates, long location and long stays (R1104-8/13)", async () => {
    host.searchMarketplace.mockClear();
    const cases: [string, string][] = [
      ["minNightly=300&maxNightly=100", "invalid_price_range"],
      ["minNightly=abc", "invalid_price_range"],
      ["maxNightly=-5", "invalid_price_range"],
      ["checkIn=2026-12-01&checkOut=2026-12-04&flexibilityDays=-1", "invalid_flexibility_days"],
      ["checkIn=2026-12-01&checkOut=2026-12-04&flexibilityDays=15", "invalid_flexibility_days"],
      ["checkIn=2026-12-01&checkOut=2026-12-04&flexibilityDays=abc", "invalid_flexibility_days"],
      ["checkIn=2026-12-01", "incomplete_dates"],
      ["checkOut=2026-12-04", "incomplete_dates"],
      [`location=${"a".repeat(201)}`, "invalid_location"],
      ["checkIn=2026-12-01&checkOut=2029-08-27", "stay_too_long"],
    ];
    for (const [q, code] of cases) {
      const res = await get(q);
      expect(res.status, q).toBe(400);
      expect(res.headers.get("Access-Control-Allow-Origin"), q).toBe("*");
      expect(await res.json(), q).toMatchObject({ ok: false, code });
    }
    expect(host.searchMarketplace).not.toHaveBeenCalled();
    expect((await get(`location=${"a".repeat(200)}`)).status).toBe(200);
    expect((await get("minNightly=100&maxNightly=100")).status).toBe(200);
    expect(
      (await get("checkIn=2026-12-01&checkOut=2027-03-01&flexibilityDays=0")).status,
    ).toBe(200);
  });

  it("keeps a normal party as sent and 400s junk guests / pets (T54)", async () => {
    const two = await (await get("guests=2")).json();
    expect(two.query.guests).toBe(2);
    expect(new URL(two.humanSearchUrl).searchParams.get("guests")).toBe("2");
    host.searchMarketplace.mockClear();
    for (const g of ["abc", "-5", "0", "2.5"]) {
      const res = await get(`guests=${g}`);
      expect(res.status, g).toBe(400);
      expect(await res.json(), g).toMatchObject({ ok: false, code: "invalid_guests" });
    }
    for (const p of ["abc", "-1", "1.5", "99", "11", "5"]) {
      const res = await get(`guests=2&pets=${p}`);
      expect(res.status, p).toBe(400);
      const body = await res.json();
      expect(body, p).toMatchObject({ ok: false, code: "invalid_pets" });
      if (p === "5") expect(JSON.stringify(body)).toContain("0 to 4");
    }
    expect(host.searchMarketplace).not.toHaveBeenCalled();
  });

  it("?lake= is an alias for location; location wins when both are sent", async () => {
    await get("lake=Cedar%20Creek%20Lake");
    await get("location=Malakoff");
    expect(JSON.stringify(host.searchMarketplace.mock.calls[0])).toContain("Cedar Creek Lake");
    expect(JSON.stringify(host.searchMarketplace.mock.calls[0])).toEqual(
      JSON.stringify(host.searchMarketplace.mock.calls[1]).replace("Malakoff", "Cedar Creek Lake"),
    );
    host.searchMarketplace.mockClear();
    await get("location=Malakoff&lake=Cedar");
    expect(JSON.stringify(host.searchMarketplace.mock.calls[0])).toContain("Malakoff");
    expect(JSON.stringify(host.searchMarketplace.mock.calls[0])).not.toContain("Cedar");
  });
});
