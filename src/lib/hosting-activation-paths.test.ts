/**
 * T48(2) proof: a $0 invoice or any invoice on a test brand never makes a
 * brand ACTIVE on the webhook path (by Stripe id) or the Stripe-synced
 * platform-invoice path. In-memory fakes only; no Stripe, no prod data.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const m = {
    host: { findUnique: vi.fn(), findFirst: vi.fn(async () => null), update: vi.fn(async (_a: unknown) => ({})) },
    property: { count: vi.fn(async () => 1) },
    hostingInvoice: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(async ({ data }: { data: object }) => ({ id: "hi", ...data })),
      create: vi.fn(async ({ data }: { data: object }) => ({ id: "hi", ...data })),
    },
    $transaction: vi.fn(),
  };
  m.$transaction.mockImplementation(async (fn: (tx: typeof m) => unknown) => fn(m));
  return m;
});
const promote = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/platform-billing", () => ({
  ensurePlatformCustomer: vi.fn(),
  customerHasCardOnFile: vi.fn(),
  promoteComplimentaryHostIfPaid: promote,
  stripeObjectId: (v: unknown) => (typeof v === "string" ? v : null),
}));

import { markHostingInvoicePaidByStripeId, recordStripePlatformInvoice } from "./hosting-billing";

const realHost = (isTestBrand: boolean) => ({
  id: "h1", planId: null, plan: null, isTestBrand, subscriptionStatus: "PENDING_PAYMENT",
  currentPeriodStart: null, currentPeriodEnd: null, stripeCustomerId: "cus_1", stripeSubscriptionId: null,
});
const activated = () =>
  db.host.update.mock.calls.some((c) => (c[0] as unknown as { data: { subscriptionStatus?: string } }).data.subscriptionStatus === "ACTIVE");

beforeEach(() => {
  vi.clearAllMocks();
  db.hostingInvoice.findUnique.mockResolvedValue(null);
});

describe("webhook invoice.paid / invoice.payment_succeeded → markHostingInvoicePaidByStripeId", () => {
  const row = (amount: number) => ({
    id: "hi", hostId: "h1", status: "OPEN", paidAt: null, amount,
    periodStart: new Date("2026-11-01"), periodEnd: new Date("2026-12-01"),
  });
  it("$0 invoice: not activated", async () => {
    db.hostingInvoice.findFirst.mockResolvedValue(row(0));
    db.hostingInvoice.findUnique.mockResolvedValue(row(0));
    db.host.findUnique.mockResolvedValue({ isTestBrand: false });
    await markHostingInvoicePaidByStripeId("in_zero");
    expect(activated()).toBe(false);
  });
  it("test brand $30 invoice: not activated", async () => {
    db.hostingInvoice.findFirst.mockResolvedValue(row(30));
    db.hostingInvoice.findUnique.mockResolvedValue(row(30));
    db.host.findUnique.mockResolvedValue({ isTestBrand: true });
    await markHostingInvoicePaidByStripeId("in_test");
    expect(activated()).toBe(false);
  });
  it("real brand $30 invoice: activated (control)", async () => {
    db.hostingInvoice.findFirst.mockResolvedValue(row(30));
    db.hostingInvoice.findUnique.mockResolvedValue(row(30));
    db.host.findUnique.mockResolvedValue({ isTestBrand: false });
    await markHostingInvoicePaidByStripeId("in_real");
    expect(activated()).toBe(true);
  });
});

describe("Stripe-synced platform invoice → recordStripePlatformInvoice", () => {
  const inv = (cents: number) => ({
    id: "in_sync", status: "paid", amount_paid: cents, amount_due: cents, customer: "cus_1",
    metadata: { kind: "hosting_subscription", hostId: "h1" }, created: 1793000000,
  });
  it("$0 paid invoice: recorded, not activated, no complimentary promotion", async () => {
    db.host.findUnique.mockResolvedValue(realHost(false));
    await recordStripePlatformInvoice(inv(0));
    expect(activated()).toBe(false);
    expect(promote).not.toHaveBeenCalled();
  });
  it("test brand $30 paid invoice: recorded, not activated", async () => {
    db.host.findUnique.mockResolvedValue(realHost(true));
    const rec = await recordStripePlatformInvoice(inv(3000));
    expect(rec).toMatchObject({ status: "PAID" });
    expect(activated()).toBe(false);
    expect(promote).not.toHaveBeenCalled();
  });
  it("real brand $30 paid invoice: activated (control)", async () => {
    db.host.findUnique.mockResolvedValue(realHost(false));
    await recordStripePlatformInvoice(inv(3000));
    expect(activated()).toBe(true);
  });
});
