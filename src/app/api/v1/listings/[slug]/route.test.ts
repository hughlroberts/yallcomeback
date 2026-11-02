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

const db = vi.hoisted(() => ({
  prisma: { property: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/host", () => ({
  marketplacePropertyWhere: () => ({}),
  searchMarketplace: vi.fn(),
}));

import { GET } from "./route";
import { GET as searchGET } from "../../search/route";

const ctx = { params: Promise.resolve({ slug: "motel-room-2" }) };
const get = (q: string) =>
  GET(
    new NextRequest(
      `https://www.yallcomeback.app/api/v1/listings/motel-room-2?${q}`,
    ),
    ctx,
  );

const ymd = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 86400_000).toISOString().slice(0, 10);

describe("GET /api/v1/listings/{slug} date validation", () => {
  beforeAll(() => vi.stubEnv("AGENT_API_ENABLED", "true"));
  afterAll(() => vi.unstubAllEnvs());
  beforeEach(() => {
    db.prisma.property.findFirst.mockReset();
    db.prisma.property.findFirst.mockResolvedValue(null);
  });

  it.each([
    ["past", `checkIn=${ymd(-10)}&checkOut=${ymd(-8)}`, "past_dates"],
    [
      "reversed",
      `checkIn=${ymd(20)}&checkOut=${ymd(18)}`,
      "checkout_not_after_checkin",
    ],
    ["invalid", `checkIn=2030-02-30&checkOut=2030-03-02`, "invalid_date"],
    ["not a date", `checkIn=soon&checkOut=${ymd(5)}`, "invalid_date"],
  ])("returns 400 for %s dates", async (_label, q, code) => {
    const res = await get(q);
    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = await res.json();
    expect(body).toEqual({ ok: false, code, error: expect.any(String) });
    expect(db.prisma.property.findFirst).not.toHaveBeenCalled();
  });

  it("uses the same 400 body as search for the same dates", async () => {
    const q = `checkIn=${ymd(20)}&checkOut=${ymd(18)}`;
    const listing = await (await get(q)).json();
    const search = await (
      await searchGET(
        new NextRequest(`https://www.yallcomeback.app/api/v1/search?${q}`),
      )
    ).json();
    expect(listing).toEqual(search);
  });

  it("still looks the listing up for good or missing dates", async () => {
    expect((await get(`checkIn=${ymd(20)}&checkOut=${ymd(22)}`)).status).toBe(
      404,
    );
    expect((await get("")).status).toBe(404);
    expect(db.prisma.property.findFirst).toHaveBeenCalledTimes(2);
  });
});
