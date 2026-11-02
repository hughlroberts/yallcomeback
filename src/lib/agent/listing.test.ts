import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: { property: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/agent/availability", () => ({
  isStayAvailable: vi.fn().mockResolvedValue(true),
  findAvailableWindows: vi.fn().mockResolvedValue([]),
}));

import { getAgentListingDetail } from "./listing";

// Shaped like motel-room-2 once the host sets $10/night beyond 2 guests.
function motel(extraGuestFee: number) {
  return {
    id: "p1",
    slug: "motel-room-2",
    title: "Motel Room 2",
    tagline: null,
    description: "",
    propertyType: "motel",
    spaceType: "entire_place",
    address: null,
    postalCode: null,
    latitude: null,
    longitude: null,
    city: "Malakoff",
    region: "Texas",
    country: "United States",
    showPreciseLocation: false,
    bedrooms: 1,
    bathrooms: 1,
    beds: 1,
    maxGuests: 4,
    baseNightlyRate: 75,
    cleaningFee: 35,
    extraGuestFee,
    extraGuestsIncluded: 2,
    weekendPremiumPercent: 0,
    defaultMinNights: 1,
    petsAllowed: false,
    maxPets: 0,
    petFee: 0,
    petFeeUnit: "PER_STAY",
    depositPercent: 30,
    discountNewListingPercent: 0,
    discountLastMinutePercent: 0,
    discountWeeklyPercent: 0,
    discountMonthlyPercent: 0,
    checkInTime: "15:00",
    checkOutTime: "11:00",
    houseRules: null,
    cancellationPolicy: "MODERATE",
    longTermCancellationPolicy: "FIRM",
    amenities: null,
    images: [],
    seasons: [],
    host: { id: "h1", name: "Host", slug: "cherokee", tagline: null },
  };
}

const dates = { checkIn: "2030-03-04", checkOut: "2030-03-06" }; // 2 nights

describe("API listing quote: extra-guest fee", () => {
  beforeEach(() => db.prisma.property.findFirst.mockReset());

  it("shows the fee settings and charges guests beyond the included count", async () => {
    db.prisma.property.findFirst.mockResolvedValue(motel(10));
    const d = await getAgentListingDetail("https://x.test", "motel-room-2", {
      ...dates,
      guests: 4,
    });
    expect(d?.extraGuestFee).toBe(10);
    expect(d?.extraGuestsIncluded).toBe(2);
    const q = d?.availability.quote;
    expect(q).toMatchObject({
      guests: 4,
      extraGuests: 2,
      extraGuestFee: 40, // 2 extra × $10 × 2 nights
      nightlySubtotal: 150,
      totalAmount: 225, // 150 + 40 + 35 cleaning
    });
  });

  it("caps guests at the listing max before pricing", async () => {
    db.prisma.property.findFirst.mockResolvedValue(motel(10));
    const d = await getAgentListingDetail("https://x.test", "motel-room-2", {
      ...dates,
      guests: 9,
    });
    expect(d?.availability.quote).toMatchObject({
      guests: 4,
      extraGuestFee: 40,
    });
  });

  it("charges nothing extra while the fee is $0 (unconfigured)", async () => {
    db.prisma.property.findFirst.mockResolvedValue(motel(0));
    const d = await getAgentListingDetail("https://x.test", "motel-room-2", {
      ...dates,
      guests: 4,
    });
    expect(d?.availability.quote).toMatchObject({
      extraGuests: 0,
      extraGuestFee: 0,
      totalAmount: 185,
    });
  });
});

describe("API listing bookUrl keeps the party", () => {
  beforeEach(() => db.prisma.property.findFirst.mockReset());

  it("carries dates, guests and pets into /book", async () => {
    db.prisma.property.findFirst.mockResolvedValue(motel(10));
    const d = await getAgentListingDetail("https://x.test", "motel-room-2", {
      ...dates,
      guests: 4,
      pets: 1,
    });
    const u = new URL(d!.bookUrl);
    expect(u.origin + u.pathname).toBe("https://x.test/book/motel-room-2");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      checkIn: "2030-03-04",
      checkOut: "2030-03-06",
      guests: "4",
      pets: "1",
    });
  });

  it("keeps guests and pets without dates, and drops junk values", async () => {
    db.prisma.property.findFirst.mockResolvedValue(motel(10));
    const d = await getAgentListingDetail("https://x.test", "motel-room-2", {
      checkIn: "2030-03-04",
      checkOut: "soon",
      guests: 3,
      pets: Number("x"),
    });
    expect(d!.bookUrl).toBe("https://x.test/book/motel-room-2?guests=3");
  });

  it("is the bare book page with nothing requested", async () => {
    db.prisma.property.findFirst.mockResolvedValue(motel(10));
    const d = await getAgentListingDetail("https://x.test", "motel-room-2");
    expect(d!.bookUrl).toBe("https://x.test/book/motel-room-2");
  });

  it("hides an import note in the API description", async () => {
    db.prisma.property.findFirst.mockResolvedValue({
      ...motel(10),
      description:
        "Lake house.\r\n\r\n—\r\nImported from Airbnb\r\nhttps://www.airbnb.com/rooms/1",
    });
    const d = await getAgentListingDetail("https://x.test", "motel-room-2");
    expect(d!.description).toBe("Lake house.");
  });
});
