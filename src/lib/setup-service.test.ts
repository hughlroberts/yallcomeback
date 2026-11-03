import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    host: { updateMany: vi.fn(), findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    setupServicePayment: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));
const mail = vi.hoisted(() => ({
  dispatchPlatformEmail: vi.fn<(args: Record<string, unknown>) => Promise<{ ok: boolean }>>(
    async () => ({ ok: true }),
  ),
}));
const stripe = vi.hoisted(() => {
  const client = {
    checkout: {
      sessions: {
        create: vi.fn<(a: Record<string, unknown>) => Promise<Record<string, unknown>>>(),
        retrieve: vi.fn<(id: string) => Promise<Record<string, unknown>>>(),
        expire: vi.fn<(id: string) => Promise<object>>(async () => ({})),
      },
    },
  };
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
  duplicateSetupEmailText,
  recordSetupServicePayment,
  setupCheckoutBlock,
  setupPurchaseEmailText,
  setupServiceCheckoutUrl,
  setupServiceDone,
} from "./setup-service";

const TOTAL = 51525;
const paid = {
  id: "cs_1",
  metadata: { kind: "setup_service", hostId: "h1" },
  payment_status: "paid",
  amount_total: TOTAL,
  customer: "cus_1",
  payment_intent: "pi_1",
};
const qaHost = {
  id: "h1",
  name: "QA Marketplace Test",
  slug: "qa-marketplace-test",
  contactEmail: "qa@example.com",
  billingEmail: null,
  users: [],
};
const checkoutHost = (over: Record<string, unknown> = {}) =>
  ({
    id: "h1",
    name: "QA Marketplace Test",
    slug: "qa-marketplace-test",
    stripeCustomerId: "cus_1",
    contactEmail: null,
    billingEmail: null,
    setupServiceStatus: "NONE",
    setupServiceOpenSessionId: null,
    ...over,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PLATFORM_ALERT_EMAIL", "alerts@example.com");
  db.prisma.user.findMany.mockResolvedValue([]);
  db.prisma.setupServicePayment.updateMany.mockResolvedValue({ count: 1 });
});

describe("who may buy Full setup by card (T45/T46)", () => {
  it("PAID, WAIVED and INVOICED cannot pay by card", () => {
    expect(setupServiceDone("PAID")).toBe(true);
    expect(setupServiceDone("WAIVED")).toBe(true);
    expect(setupCheckoutBlock("PAID")).toBe("setup_paid");
    expect(setupCheckoutBlock("WAIVED")).toBe("setup_paid");
    expect(setupCheckoutBlock("INVOICED")).toBe("setup_invoiced");
    expect(setupCheckoutBlock("REQUESTED")).toBeNull();
    expect(setupCheckoutBlock("NONE")).toBeNull();
  });

  it("refuses checkout when paid or invoiced, without calling Stripe", async () => {
    await expect(setupServiceCheckoutUrl(checkoutHost({ setupServiceStatus: "PAID" }))).rejects.toMatchObject({ code: "setup_paid" });
    await expect(setupServiceCheckoutUrl(checkoutHost({ setupServiceStatus: "INVOICED" }))).rejects.toMatchObject({ code: "setup_invoiced" });
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripe.client.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });
});

describe("setup checkout session (T46)", () => {
  it("new checkout: one-time $500 + $15.25, session id stored", async () => {
    stripe.client.checkout.sessions.create.mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.test/new" });
    db.prisma.host.updateMany.mockResolvedValue({ count: 1 });
    expect(await setupServiceCheckoutUrl(checkoutHost())).toBe("https://checkout.stripe.test/new");
    const args = stripe.client.checkout.sessions.create.mock.calls[0][0] as {
      mode: string;
      line_items: { price_data: { unit_amount: number } }[];
      metadata: unknown;
      success_url: string;
    };
    expect(args.mode).toBe("payment");
    expect(args.line_items.map((l) => l.price_data.unit_amount)).toEqual([50000, 1525]);
    expect(args.metadata).toEqual({ kind: "setup_service", hostId: "h1" });
    expect(args.success_url).toContain("setup=paid");
    expect(db.prisma.host.updateMany).toHaveBeenCalledWith({
      where: { id: "h1", setupServiceOpenSessionId: null, setupServiceStatus: { notIn: ["PAID", "WAIVED", "INVOICED"] } },
      data: { setupServiceOpenSessionId: "cs_new" },
    });
  });

  it("reuses the open session (second tab gets the same page)", async () => {
    stripe.client.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_open", status: "open", payment_status: "unpaid", amount_total: TOTAL, url: "https://checkout.stripe.test/open",
    });
    expect(await setupServiceCheckoutUrl(checkoutHost({ setupServiceOpenSessionId: "cs_open" }))).toBe("https://checkout.stripe.test/open");
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripe.client.checkout.sessions.expire).not.toHaveBeenCalled();
  });

  it("expires a stale open session (old amount) before creating a new one", async () => {
    stripe.client.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_old", status: "open", payment_status: "unpaid", amount_total: 50000, url: "https://x",
    });
    stripe.client.checkout.sessions.create.mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.test/new" });
    db.prisma.host.updateMany.mockResolvedValue({ count: 1 });
    await setupServiceCheckoutUrl(checkoutHost({ setupServiceOpenSessionId: "cs_old" }));
    expect(stripe.client.checkout.sessions.expire).toHaveBeenCalledWith("cs_old");
    const expireOrder = stripe.client.checkout.sessions.expire.mock.invocationCallOrder[0];
    const createOrder = stripe.client.checkout.sessions.create.mock.invocationCallOrder[0];
    expect(expireOrder).toBeLessThan(createOrder);
  });

  it("stored session already paid: records it, no new checkout", async () => {
    stripe.client.checkout.sessions.retrieve.mockResolvedValue({ ...paid, id: "cs_paid", status: "complete" });
    db.prisma.host.findUnique.mockResolvedValue({ setupServiceStatus: "NONE", setupServiceCheckoutSessionId: null });
    db.prisma.setupServicePayment.create.mockResolvedValue({});
    db.prisma.host.updateMany.mockResolvedValue({ count: 1 });
    await expect(setupServiceCheckoutUrl(checkoutHost({ setupServiceOpenSessionId: "cs_paid" }))).rejects.toMatchObject({ code: "setup_paid" });
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled();
    expect(db.prisma.setupServicePayment.create).toHaveBeenCalled();
  });

  it("two clicks at once: the loser expires its own session and uses the winner's", async () => {
    stripe.client.checkout.sessions.create.mockResolvedValue({ id: "cs_mine", url: "https://checkout.stripe.test/mine" });
    db.prisma.host.updateMany.mockResolvedValue({ count: 0 });
    db.prisma.host.findUnique.mockResolvedValue({ setupServiceStatus: "NONE", setupServiceOpenSessionId: "cs_winner" });
    stripe.client.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_winner", status: "open", payment_status: "unpaid", amount_total: TOTAL, url: "https://checkout.stripe.test/winner",
    });
    expect(await setupServiceCheckoutUrl(checkoutHost())).toBe("https://checkout.stripe.test/winner");
    expect(stripe.client.checkout.sessions.expire).toHaveBeenCalledWith("cs_mine");
  });
});

describe("recordSetupServicePayment (T46)", () => {
  beforeEach(() => {
    db.prisma.host.findUnique.mockImplementation((async (q: { select?: Record<string, unknown> }) =>
      q.select && "setupServiceStatus" in q.select
        ? { setupServiceStatus: "REQUESTED", setupServiceCheckoutSessionId: null }
        : qaHost) as never);
  });

  it("first payment: records, marks PAID, clears the open session, emails the admin once", async () => {
    db.prisma.setupServicePayment.create.mockResolvedValue({});
    db.prisma.host.updateMany.mockResolvedValue({ count: 1 });
    expect(await recordSetupServicePayment(paid)).toBe("recorded");
    expect(db.prisma.setupServicePayment.create).toHaveBeenCalledWith({
      data: { hostId: "h1", sessionId: "cs_1", paymentIntentId: "pi_1", amountCents: TOTAL },
    });
    expect(db.prisma.host.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "h1", setupServiceStatus: { notIn: ["PAID", "WAIVED"] } },
      data: { setupServiceStatus: "PAID", setupServiceCheckoutSessionId: "cs_1", setupServiceOpenSessionId: null },
    });
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(1);
    expect(mail.dispatchPlatformEmail.mock.calls[0][0]).toMatchObject({
      to: "alerts@example.com",
      subject: "Full setup purchased: QA Marketplace Test",
    });
  });

  it("webhook replay of the same session: nothing recorded twice, no email", async () => {
    db.prisma.setupServicePayment.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    expect(await recordSetupServicePayment(paid)).toBe("already");
    expect(db.prisma.host.updateMany).not.toHaveBeenCalled();
    expect(mail.dispatchPlatformEmail).not.toHaveBeenCalled();
  });

  it("session paid before T46 (stored on the brand): already", async () => {
    db.prisma.host.findUnique.mockResolvedValue({ setupServiceStatus: "PAID", setupServiceCheckoutSessionId: "cs_1" });
    expect(await recordSetupServicePayment(paid)).toBe("already");
    expect(db.prisma.setupServicePayment.create).not.toHaveBeenCalled();
  });

  it("second paid session: kept, flagged duplicate, admin alerted, never refunded", async () => {
    db.prisma.host.findUnique.mockImplementation((async (q: { select?: Record<string, unknown> }) =>
      q.select && "setupServiceStatus" in q.select
        ? { setupServiceStatus: "PAID", setupServiceCheckoutSessionId: "cs_first" }
        : qaHost) as never);
    db.prisma.setupServicePayment.create.mockResolvedValue({});
    db.prisma.host.updateMany.mockResolvedValue({ count: 0 });
    const dup = { ...paid, id: "cs_2" };
    expect(await recordSetupServicePayment(dup)).toBe("duplicate");
    expect(db.prisma.setupServicePayment.update).toHaveBeenCalledWith({
      where: { sessionId: "cs_2" },
      data: { duplicate: true },
    });
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(1);
    expect(mail.dispatchPlatformEmail.mock.calls[0][0]).toMatchObject({
      subject: "Second Full setup payment: QA Marketplace Test",
    });
    expect(String(mail.dispatchPlatformEmail.mock.calls[0][0].text)).toMatch(/Nothing was refunded automatically/);
    // A replay of that duplicate does not alert again.
    db.prisma.setupServicePayment.updateMany.mockResolvedValue({ count: 0 });
    db.prisma.setupServicePayment.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    expect(await recordSetupServicePayment(dup)).toBe("already");
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(1);
  });

  it("ignores unpaid, other kinds, and another brand's session", async () => {
    expect(await recordSetupServicePayment({ ...paid, payment_status: "unpaid" })).toBe("ignored");
    expect(await recordSetupServicePayment({ ...paid, metadata: { kind: "hosting", hostId: "h1" } })).toBe("ignored");
    expect(await recordSetupServicePayment(paid, "h_other")).toBe("ignored");
    expect(db.prisma.setupServicePayment.create).not.toHaveBeenCalled();
  });
});

describe("admin emails", () => {
  const facts = {
    hostName: "QA", slug: "qa", hostId: "h1", contact: "qa@example.com",
    totalUsd: "$515.25", sessionId: "cs_1", customerId: "cus_1",
  };
  it("purchase email has the facts, warns when also invoiced, no admin URL", () => {
    const text = setupPurchaseEmailText({ ...facts, wasInvoiced: true });
    expect(text).toContain("Paid: $515.25");
    expect(text).toMatch(/Void that invoice/);
    expect(text).not.toMatch(/\/ops|https?:\/\//);
    expect(setupPurchaseEmailText(facts)).not.toMatch(/Void/);
  });
  it("duplicate email says refund by hand, no admin URL", () => {
    const text = duplicateSetupEmailText({ ...facts, previousStatus: "PAID" });
    expect(text).toMatch(/refund it by hand/);
    expect(text).not.toMatch(/\/ops|https?:\/\//);
  });
});
