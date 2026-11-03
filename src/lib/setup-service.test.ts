import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    host: { updateMany: vi.fn(), findUnique: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));
const mail = vi.hoisted(() => ({ dispatchPlatformEmail: vi.fn<(args: Record<string, unknown>) => Promise<{ ok: boolean }>>(async () => ({ ok: true })) }));
const stripe = vi.hoisted(() => {
  const client = { checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } } };
  return { client, mod: { requireStripeClient: () => client } };
});
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/messaging", () => mail);
vi.mock("@/lib/stripe", () => stripe.mod);
vi.mock("@/lib/notification-prefs", () => ({ canSendEmailTo: vi.fn(async () => true) }));
vi.mock("@/lib/features", () => ({ canonicalSiteOrigin: () => "https://ycb.test" }));
vi.mock("@/lib/platform-billing", () => ({
  HostingBillingError: class extends Error {
    constructor(public code: string) {
      super(code);
    }
  },
  ensurePlatformCustomer: vi.fn(async () => "cus_1"),
  stripeObjectId: (v: unknown) => (typeof v === "string" ? v : null),
}));

import {
  recordSetupServicePayment,
  setupPurchaseEmailText,
  setupServiceCheckoutUrl,
  setupServiceDone,
} from "./setup-service";

const paid = {
  id: "cs_1",
  metadata: { kind: "setup_service", hostId: "h1" },
  payment_status: "paid",
  amount_total: 51525,
  customer: "cus_1",
};

describe("Full setup purchase (T45)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PLATFORM_ALERT_EMAIL", "alerts@example.com");
    db.prisma.host.findUnique.mockResolvedValue({
      id: "h1",
      name: "QA Marketplace Test",
      slug: "qa-mkt",
      contactEmail: "qa@example.com",
      billingEmail: null,
      users: [],
    });
    db.prisma.user.findMany.mockResolvedValue([]);
  });

  it("PAID and WAIVED cannot buy again", () => {
    expect(setupServiceDone("PAID")).toBe(true);
    expect(setupServiceDone("WAIVED")).toBe(true);
    expect(setupServiceDone("REQUESTED")).toBe(false);
    expect(setupServiceDone("NONE")).toBe(false);
  });

  it("checkout is a one-time payment: $500 + $15.25 card processing", async () => {
    stripe.client.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.test/p" });
    const url = await setupServiceCheckoutUrl({
      id: "h1",
      name: "QA",
      slug: "qa",
      stripeCustomerId: "cus_1",
      contactEmail: null,
      billingEmail: null,
      setupServiceStatus: "NONE",
    } as never);
    expect(url).toBe("https://checkout.stripe.test/p");
    const args = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(args.mode).toBe("payment");
    expect(args.line_items.map((l: { price_data: { unit_amount: number } }) => l.price_data.unit_amount)).toEqual([50000, 1525]);
    expect(args.metadata).toEqual({ kind: "setup_service", hostId: "h1" });
    expect(args.success_url).toContain("setup=paid");
    expect(args.success_url).toContain("#setup");
  });

  it("refuses checkout when already paid", async () => {
    await expect(
      setupServiceCheckoutUrl({ id: "h1", setupServiceStatus: "PAID" } as never),
    ).rejects.toMatchObject({ code: "setup_paid" });
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("records once and emails the admin once", async () => {
    db.prisma.host.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 });
    expect(await recordSetupServicePayment(paid)).toBe("recorded");
    expect(db.prisma.host.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "h1", setupServiceStatus: { not: "PAID" } },
      data: { setupServiceStatus: "PAID", setupServiceAmount: 500, setupServiceCheckoutSessionId: "cs_1" },
    });
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(1);
    expect(mail.dispatchPlatformEmail.mock.calls[0][0]).toMatchObject({
      to: "alerts@example.com",
      subject: "Full setup purchased: QA Marketplace Test",
      replyTo: "qa@example.com",
    });

    // Webhook after the success page: no second record, no second email.
    db.prisma.host.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
    expect(await recordSetupServicePayment(paid)).toBe("already");
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(1);
  });

  it("ignores unpaid, other kinds, and another brand's session", async () => {
    expect(await recordSetupServicePayment({ ...paid, payment_status: "unpaid" })).toBe("ignored");
    expect(await recordSetupServicePayment({ ...paid, metadata: { kind: "hosting", hostId: "h1" } })).toBe("ignored");
    expect(await recordSetupServicePayment(paid, "h_other")).toBe("ignored");
    expect(db.prisma.host.updateMany).not.toHaveBeenCalled();
  });

  it("admin email has the facts and no admin URL", () => {
    const text = setupPurchaseEmailText({
      hostName: "QA",
      slug: "qa",
      hostId: "h1",
      contact: "qa@example.com",
      totalUsd: "$515.25",
      sessionId: "cs_1",
      customerId: "cus_1",
    });
    expect(text).toContain("Paid: $515.25");
    expect(text).toContain("Contact: qa@example.com");
    expect(text).not.toMatch(/\/ops|https?:\/\//);
  });
});
