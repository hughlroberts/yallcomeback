import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  checkout: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findFirst: m.findFirst },
    hostTaxLine: { findMany: vi.fn(async () => []) },
    booking: { update: vi.fn() },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ booking: { create: m.create } }),
  },
}));
vi.mock("@/lib/availability", () => ({
  isRangeAvailable: vi.fn(async () => true),
  lockPropertyBookings: vi.fn(async () => undefined),
}));
vi.mock("@/lib/host", () => ({ marketplacePropertyWhere: () => ({}) }));
vi.mock("@/lib/hosting", () => ({ canHostAddFutureWork: () => true }));
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => true,
  toStripeAmount: (n: number) => Math.round(n * 100),
}));
vi.mock("@/lib/stripe-connect", () => ({
  createDirectChargeCheckout: m.checkout,
  depositCheckoutName: (t: string) => `Deposit: ${t}`,
}));
vi.mock("@/lib/analytics", () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock("@/lib/booking-access", () => ({ bookingAccessToken: () => "tok" }));

import { createAgentStayCheckout } from "./checkout";

// motel-room-2: $75 for 2 guests, sleeps 4, $35 cleaning, 30% deposit.
function motel(extraGuestFee: number) {
  return {
    id: "p1",
    slug: "motel-room-2",
    title: "Motel Room 2",
    hostId: "h1",
    published: true,
    listOnMarketplace: true,
    maxGuests: 4,
    baseNightlyRate: 75,
    weekendPremiumPercent: 0,
    defaultMinNights: 1,
    cleaningFee: 35,
    extraGuestFee,
    extraGuestsIncluded: 2,
    petsAllowed: false,
    maxPets: 0,
    petFee: 0,
    petFeeUnit: "PER_STAY",
    depositPercent: 30,
    discountNewListingPercent: 0,
    discountLastMinutePercent: 0,
    discountWeeklyPercent: 0,
    discountMonthlyPercent: 0,
    cancellationPolicy: "MODERATE",
    longTermCancellationPolicy: "FIRM",
    disclaimer: null,
    seasons: [],
    host: {
      stripeAccountId: "acct_test",
      taxLiabilityAcknowledged: false,
      defaultDisclaimer: null,
    },
  };
}

const input = {
  slug: "motel-room-2",
  checkIn: "2030-03-04", // Mon
  checkOut: "2030-03-06", // 2 nights
  guests: 4,
  guestName: "Jo",
  guestEmail: "jo@example.com",
  acceptTerms: true,
};

describe("Stripe checkout amount: extra-guest fee (motel-room-2, guests=4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.create.mockResolvedValue({ id: "b1" });
    m.checkout.mockResolvedValue({ url: "https://checkout.test/s" });
  });

  it("$10/night beyond 2 adds $20 per night to the total and the deposit", async () => {
    m.findFirst.mockResolvedValue(motel(10));
    const r = await createAgentStayCheckout(input);
    expect(r.ok).toBe(true);
    // 2 × $75 + 2 extra × $10 × 2 nights ($40) + $35 = $225; 30% = $67.50
    if (r.ok) expect(r.quote).toEqual({ nights: 2, totalAmount: 225, depositAmount: 67.5 });
    expect(m.checkout.mock.calls[0]![0].amountCents).toBe(6750);
    expect(m.create.mock.calls[0]![0].data).toMatchObject({
      extraGuestFee: 40,
      nightlySubtotal: 190,
      totalAmount: 225,
      depositAmount: 67.5,
    });
  });

  it("with the fee at $0 the same party pays no extra", async () => {
    m.findFirst.mockResolvedValue(motel(0));
    const r = await createAgentStayCheckout(input);
    if (r.ok) expect(r.quote.totalAmount).toBe(185);
    expect(m.checkout.mock.calls[0]![0].amountCents).toBe(5550);
  });
});
