import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  seasonalPrice: { findMany: vi.fn() },
  calendarBlock: { findMany: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma }));

import { findAvailableWindows } from "./availability";

describe("findAvailableWindows G1 seasonal min stay", () => {
  beforeEach(() => {
    prisma.calendarBlock.findMany.mockReset();
    prisma.seasonalPrice.findMany.mockReset();
    prisma.calendarBlock.findMany.mockResolvedValue([]);
    prisma.seasonalPrice.findMany.mockResolvedValue([]);
  });

  it("skips windows that fail seasonal min nights (same rule as quote)", async () => {
    const seasons = [
      {
        startDate: new Date("2027-07-01T00:00:00.000Z"),
        endDate: new Date("2027-07-31T00:00:00.000Z"),
        minNights: 3,
      },
    ];
    const windows = await findAvailableWindows({
      propertyId: "p1",
      nights: 2,
      fromYmd: "2027-06-28",
      lookAheadDays: 20,
      maxWindows: 20,
      defaultMinNights: 2,
      seasons,
    });
    // No 2-night window may include a July peak night (checkout-exclusive).
    for (const w of windows) {
      expect(w.nights).toBe(2);
      const overlapsPeak =
        w.checkIn < "2027-08-01" && w.checkOut > "2027-07-01";
      expect(overlapsPeak).toBe(false);
    }
    // A free 2-night stay before the peak is still offered.
    expect(windows.some((w) => w.checkIn === "2027-06-28")).toBe(true);
  });

  it("offers nights=3 windows inside a 3-night seasonal min", async () => {
    const seasons = [
      {
        startDate: new Date("2027-07-01T00:00:00.000Z"),
        endDate: new Date("2027-07-31T00:00:00.000Z"),
        minNights: 3,
      },
    ];
    const windows = await findAvailableWindows({
      propertyId: "p1",
      nights: 3,
      fromYmd: "2027-07-01",
      lookAheadDays: 14,
      maxWindows: 5,
      defaultMinNights: 2,
      seasons,
    });
    expect(windows.length).toBeGreaterThan(0);
    expect(windows[0]).toMatchObject({
      checkIn: "2027-07-01",
      checkOut: "2027-07-04",
      nights: 3,
    });
  });

  it("loads seasons from prisma when not injected", async () => {
    prisma.seasonalPrice.findMany.mockResolvedValue([
      {
        startDate: new Date("2027-07-01T00:00:00.000Z"),
        endDate: new Date("2027-07-31T00:00:00.000Z"),
        minNights: 3,
      },
    ]);
    const windows = await findAvailableWindows({
      propertyId: "p1",
      nights: 2,
      fromYmd: "2027-07-01",
      lookAheadDays: 14,
      maxWindows: 10,
      defaultMinNights: 2,
    });
    expect(prisma.seasonalPrice.findMany).toHaveBeenCalled();
    expect(windows).toEqual([]);
  });
});
