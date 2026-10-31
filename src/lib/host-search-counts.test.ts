import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    property: { findMany: vi.fn() },
    calendarBlock: { findMany: vi.fn() },
    seasonalPrice: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);

import { searchMarketplace } from "./host";
import { MARKETPLACE_CANDIDATE_CAP } from "./marketplace-search";

const ymd = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 86400_000).toISOString().slice(0, 10);
const at = (s: string) => new Date(`${s}T00:00:00`);

const property = (i: number) => ({
  id: `p${i}`,
  slug: `stay-${i}`,
  title: `Stay ${i}`,
  defaultMinNights: 1,
  baseNightlyRate: 100,
  maxGuests: 4,
  bedrooms: 2,
  bathrooms: 1,
  amenities: [],
  images: [],
  host: null,
});

/** n stays; the first `bookedCount` are booked on the searched night only. */
function seed(
  n: number,
  bookedCount: number,
  checkIn: string,
  checkOut: string,
) {
  db.prisma.property.findMany.mockImplementation(
    async ({ take }: { take: number }) =>
      Array.from({ length: Math.min(n, take) }, (_, i) => property(i)),
  );
  db.prisma.calendarBlock.findMany.mockResolvedValue(
    Array.from({ length: bookedCount }, (_, i) => ({
      propertyId: `p${i}`,
      startDate: at(checkIn),
      endDate: at(checkOut),
    })),
  );
  db.prisma.seasonalPrice.findMany.mockResolvedValue([]);
}

describe("searchMarketplace counts do not depend on take", () => {
  const checkIn = ymd(10);
  const checkOut = ymd(11);
  beforeEach(() => vi.clearAllMocks());

  it("labels a window with all 8 stays '8 stays' for take=2 and take=50", async () => {
    seed(8, 7, checkIn, checkOut);
    const small = await searchMarketplace(
      { checkIn, checkOut, take: 2 },
      { withFlexibleDates: true, withTotal: true },
    );
    const big = await searchMarketplace(
      { checkIn, checkOut, take: 50 },
      { withFlexibleDates: true, withTotal: true },
    );
    const best = small.flexibleDates!.suggestions[0];
    expect(best.count).toBe(8);
    expect(best.label).toMatch(/· 8 stays$/);
    expect(best.label).not.toContain("+");
    expect(small.flexibleDates!.suggestions).toEqual(
      big.flexibleDates!.suggestions,
    );
    expect(small.total).toBe(1);
    expect(small.listings).toHaveLength(1);
    // Counted over the full capped pool whatever the page size.
    for (const [args] of db.prisma.property.findMany.mock.calls) {
      expect(args.take).toBe(MARKETPLACE_CANDIDATE_CAP);
    }
  });

  it("says '200+ stays' only when the pool hits the 200 cap", async () => {
    seed(500, 1, checkIn, checkOut);
    const out = await searchMarketplace(
      { checkIn, checkOut, take: 2 },
      { withFlexibleDates: true, withTotal: true },
    );
    expect(out.total).toBe(199);
    expect(out.flexibleDates!.suggestions[0].label).toMatch(/· 200\+ stays$/);
  });
});
