import { beforeEach, describe, expect, it, vi } from "vitest";

const host = vi.hoisted(() => ({ searchMarketplace: vi.fn() }));
vi.mock("@/lib/host", () => host);
vi.mock("@/lib/db", () => ({
  prisma: { seasonalPrice: { findMany: vi.fn().mockResolvedValue([]) } },
}));

import { agentSearch } from "./search";

// Shaped like live motel-room-2: $75 covers 2 guests, $0 extra-guest fee.
const motel = {
  id: "p1",
  slug: "motel-room-2",
  title: "Motel Room 2",
  tagline: null,
  city: "Malakoff",
  region: "Texas",
  country: "United States",
  propertyType: "motel",
  baseNightlyRate: 75,
  cleaningFee: 35,
  extraGuestFee: 0,
  extraGuestsIncluded: 2,
  maxGuests: 4,
  bedrooms: 1,
  bathrooms: 1,
  beds: 1,
  petsAllowed: false,
  maxPets: 0,
  petFee: 0,
  petFeeUnit: "PER_STAY",
  depositPercent: 30,
  weekendPremiumPercent: 0,
  defaultMinNights: 1,
  discountNewListingPercent: 0,
  discountLastMinutePercent: 0,
  discountWeeklyPercent: 0,
  discountMonthlyPercent: 0,
  amenities: null,
  images: [],
  host: { id: "h1", name: "Cherokee Landing", slug: "cherokee-landing" },
};

const ymd = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 86400_000).toISOString().slice(0, 10);

describe("agentSearch priceEstimate.extraGuests", () => {
  beforeEach(() => {
    host.searchMarketplace.mockReset();
    host.searchMarketplace.mockResolvedValue({
      listings: [motel],
      total: 1,
      flexibleDates: null,
    });
  });

  it.each([
    [4, 2],
    [2, 0],
    [1, 0],
  ])("guests=%i → extraGuests %i even with a $0 fee", async (guests, extra) => {
    const r = await agentSearch("https://x.test", {
      checkIn: ymd(40),
      checkOut: ymd(42),
      guests,
    });
    expect(r.listings[0].priceEstimate).toMatchObject({
      extraGuests: extra,
      extraGuestFee: 0,
    });
  });
});
