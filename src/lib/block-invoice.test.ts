/** T61 gate on calendar-block card invoices: live Connect checks, 409/503, no Stripe writes when not ready. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const stripe = vi.hoisted(() => ({
  customers: { create: vi.fn(async () => ({ id: "cus_g" })) },
  invoices: {
    create: vi.fn(async () => ({ id: "in_1" })),
    retrieve: vi.fn(async () => ({ total: 10000 })),
    del: vi.fn(),
    finalizeInvoice: vi.fn(async () => ({ id: "in_1", hosted_invoice_url: "https://pay.test/in_1" })),
    sendInvoice: vi.fn(async () => ({})),
  },
  invoiceItems: { create: vi.fn(async () => ({})) },
}));
const conn = vi.hoisted(() => ({ retrieveConnectStatus: vi.fn() }));
const db = vi.hoisted(() => ({
  calendarBlock: { findUnique: vi.fn(), update: vi.fn(async ({ data }: { data: object }) => data) },
}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => stripe, toStripeAmount: (n: number) => Math.round(n * 100) }));
vi.mock("@/lib/stripe-connect", () => conn);
vi.mock("@/lib/db", () => ({ prisma: db }));

import { BlockInvoiceConnectError, sendStripeInvoiceForBlock } from "./block-invoice";
import { clearConnectReadyCache } from "./connect-readiness";

const block = (stripeAccountId: string | null) => ({
  id: "b1", propertyId: "p1", invoiceStatus: null, stripeInvoiceId: null, occupantName: "Guest",
  invoiceCurrency: "USD", startDate: new Date("2026-12-01"), endDate: new Date("2026-12-03"),
  property: { title: "QA Cabin", host: { id: "h1", name: "QA", slug: "qa", stripeAccountId } },
});
const send = () => sendStripeInvoiceForBlock({ blockId: "b1", amount: 100, guestEmail: "g@example.com" });
const noStripeWrites = () => {
  expect(stripe.customers.create).not.toHaveBeenCalled();
  expect(stripe.invoices.create).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  clearConnectReadyCache();
});

describe("sendStripeInvoiceForBlock Connect gate", () => {
  it("no Connect account: 409 connect_no_account, nothing created in Stripe", async () => {
    db.calendarBlock.findUnique.mockResolvedValue(block(null));
    await expect(send()).rejects.toMatchObject({ status: 409, code: "connect_no_account" });
    noStripeWrites();
  });
  it("details not submitted: 409 connect_details_not_submitted", async () => {
    db.calendarBlock.findUnique.mockResolvedValue(block("acct_1"));
    conn.retrieveConnectStatus.mockResolvedValue({ onboardingComplete: false, readyToProcessPayments: false });
    await expect(send()).rejects.toMatchObject({ status: 409, code: "connect_details_not_submitted" });
    noStripeWrites();
  });
  it("charges not enabled: 409 connect_charges_not_enabled", async () => {
    db.calendarBlock.findUnique.mockResolvedValue(block("acct_1"));
    conn.retrieveConnectStatus.mockResolvedValue({ onboardingComplete: true, readyToProcessPayments: false });
    await expect(send()).rejects.toMatchObject({ status: 409, code: "connect_charges_not_enabled" });
    noStripeWrites();
  });
  it("Stripe unreachable: 503 connect_status_unavailable", async () => {
    db.calendarBlock.findUnique.mockResolvedValue(block("acct_1"));
    conn.retrieveConnectStatus.mockRejectedValue(new Error("network"));
    const err = await send().catch((e) => e);
    expect(err).toBeInstanceOf(BlockInvoiceConnectError);
    expect(err).toMatchObject({ status: 503, code: "connect_status_unavailable" });
    noStripeWrites();
  });
  it("ready account: invoice is created on that connected account", async () => {
    db.calendarBlock.findUnique.mockResolvedValue(block("acct_1"));
    conn.retrieveConnectStatus.mockResolvedValue({ onboardingComplete: true, readyToProcessPayments: true });
    await send();
    expect(stripe.invoices.create).toHaveBeenCalledWith(expect.anything(), { stripeAccount: "acct_1" });
    expect(db.calendarBlock.update).toHaveBeenCalled();
  });
});
