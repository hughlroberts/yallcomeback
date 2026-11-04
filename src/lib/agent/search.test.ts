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

describe("T54b: search url / bookUrl only carry pets a listing takes", () => {
  beforeEach(() => host.searchMarketplace.mockReset());

  it("guards pets per result and rejects pets over 4 (T56)", async () => {
    const takesTwo = { ...motel, id: "p2", slug: "pets-two", petsAllowed: true, maxPets: 2 };
    const takesOne = { ...motel, id: "p3", slug: "pets-one", petsAllowed: true, maxPets: 1 };
    host.searchMarketplace.mockResolvedValue({
      listings: [takesTwo, takesOne],
      total: 2,
      flexibleDates: null,
    });
    const r = await agentSearch("https://x.test", {
      checkIn: ymd(40),
      checkOut: ymd(42),
      guests: 2,
      pets: 2,
    });
    const bySlug = Object.fromEntries(r.listings.map((l) => [l.slug, l]));
    expect(bySlug["pets-two"].url).toContain("pets=2");
    expect(bySlug["pets-two"].bookUrl).toContain("pets=2");
    expect(bySlug["pets-one"].url).not.toContain("pets=");
    expect(bySlug["pets-one"].bookUrl ?? "").not.toContain("pets=");

    for (const pets of [5, 99]) {
      await expect(
        agentSearch("https://x.test", { guests: 2, pets }),
      ).rejects.toMatchObject({ code: "invalid_pets", message: expect.stringContaining("0 to 4") });
    }
  });
});
