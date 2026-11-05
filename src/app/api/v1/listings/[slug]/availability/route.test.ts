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

const prisma = vi.hoisted(() => ({
  property: { findFirst: vi.fn() },
  calendarBlock: { findMany: vi.fn() },
}));
const avail = vi.hoisted(() => ({
  findAvailableWindows: vi.fn(),
  AVAILABILITY_MAX_LOOKAHEAD_DAYS: 180,
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/host", () => ({ marketplacePropertyWhere: () => ({}) }));
vi.mock("@/lib/agent/availability", () => avail);

import { GET } from "./route";

const get = (slug: string, q: string) =>
  GET(
    new NextRequest(
      `https://www.yallcomeback.app/api/v1/listings/${slug}/availability?${q}`,
    ),
    { params: Promise.resolve({ slug }) },
  );

describe("GET /api/v1/listings/{slug}/availability", () => {
  beforeAll(() => vi.stubEnv("AGENT_API_ENABLED", "true"));
  afterAll(() => vi.unstubAllEnvs());
  beforeEach(() => {
    prisma.property.findFirst.mockReset();
    prisma.calendarBlock.findMany.mockReset();
    avail.findAvailableWindows.mockReset();
    prisma.property.findFirst.mockResolvedValue({
      id: "p1",
      slug: "lakefront-with-private-dock-deep-sandy-bottom",
      defaultMinNights: 2,
      title: "Lakefront",
    });
    prisma.calendarBlock.findMany.mockResolvedValue([]);
    avail.findAvailableWindows.mockResolvedValue([]);
  });

  it("G5: days>180 caps lookAheadDays and returns warnings/note", async () => {
    const res = await get(
      "lakefront-with-private-dock-deep-sandy-bottom",
      "nights=2&days=365",
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.lookAheadDays).toBe(180);
    expect(json.warnings).toEqual([
      {
        code: "days_capped",
        message: expect.stringMatching(/capped at 180.*365/),
      },
    ]);
    expect(json.note).toMatch(/capped at 180/);
    expect(avail.findAvailableWindows.mock.calls[0][0].lookAheadDays).toBe(180);
  });

  it("G5: days within cap has no warnings", async () => {
    const res = await get(
      "lakefront-with-private-dock-deep-sandy-bottom",
      "nights=2&days=90",
    );
    const json = await res.json();
    expect(json.lookAheadDays).toBe(90);
    expect(json.warnings).toBeUndefined();
    expect(json.note).toBeUndefined();
  });

  it("passes defaultMinNights into findAvailableWindows (G1)", async () => {
    await get(
      "lakefront-with-private-dock-deep-sandy-bottom",
      "nights=2&from=2027-07-01",
    );
    expect(avail.findAvailableWindows.mock.calls[0][0]).toMatchObject({
      nights: 2,
      defaultMinNights: 2,
      minNights: 2,
    });
  });
});
