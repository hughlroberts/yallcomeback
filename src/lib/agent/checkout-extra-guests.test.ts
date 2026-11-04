import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  checkout: vi.fn(),
  status: vi.fn(),
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
  retrieveConnectStatus: m.status,
  depositCheckoutName: (t: string) => `Deposit: ${t}`,
}));
vi.mock("@/lib/analytics", () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock("@/lib/booking-access", () => ({ bookingAccessToken: () => "tok" }));

import { createAgentStayCheckout } from "./checkout";
import { clearConnectReadyCache } from "@/lib/connect-readiness";

beforeEach(() => {
  clearConnectReadyCache();
  m.status.mockResolvedValue({ onboardingComplete: true, readyToProcessPayments: true });
});

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

describe("T61: agent checkout requires the brand's own Connect account live-ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConnectReadyCache();
    m.create.mockResolvedValue({ id: "b1" });
    m.checkout.mockResolvedValue({ url: "https://checkout.test/s" });
  });

  const cases = [
    ["no account", { stripeAccountId: null }, null, 409, "connect_no_account"],
    ["details not submitted", {}, { onboardingComplete: false, readyToProcessPayments: false }, 409, "connect_details_not_submitted"],
    ["charges not enabled", {}, { onboardingComplete: true, readyToProcessPayments: false }, 409, "connect_charges_not_enabled"],
  ] as const;
  for (const [name, hostPatch, status, code, expectedCode] of cases) {
    it(`${name}: ${code} ${expectedCode}, no booking, no charge`, async () => {
      const p = motel(0) as Record<string, unknown> & { host: Record<string, unknown> };
      m.findFirst.mockResolvedValue({ ...p, host: { ...p.host, ...hostPatch } });
      if (status) m.status.mockResolvedValue(status);
      const r = await createAgentStayCheckout(input);
      expect(r).toMatchObject({ ok: false, status: code, code: expectedCode });
      if (!r.ok) expect(r.error).toContain("/admin/payments");
      expect(m.create).not.toHaveBeenCalled();
      expect(m.checkout).not.toHaveBeenCalled();
    });
  }

  it("Stripe unreachable: 503 connect_status_unavailable (fail closed)", async () => {
    m.findFirst.mockResolvedValue(motel(0));
    m.status.mockRejectedValue(new Error("timeout"));
    const r = await createAgentStayCheckout(input);
    expect(r).toMatchObject({ ok: false, status: 503, code: "connect_status_unavailable" });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.checkout).not.toHaveBeenCalled();
  });

  it("ready: checks THIS listing's brand account and charges on it", async () => {
    m.findFirst.mockResolvedValue(motel(0));
    m.status.mockResolvedValue({ onboardingComplete: true, readyToProcessPayments: true });
    const r = await createAgentStayCheckout(input);
    expect(r.ok).toBe(true);
    expect(m.status).toHaveBeenCalledWith("acct_test");
    expect(m.checkout.mock.calls[0][0].accountId).toBe("acct_test");
  });
});
