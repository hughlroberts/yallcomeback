/**
 * T50: "Issue renewal invoice" must never leave a brand ACTIVE or with a
 * moved billing period when the invoice was not created and nothing was
 * paid. Stripe and the database are in-memory fakes (no real keys or data).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  host: {} as Record<string, unknown>,
  invoices: [] as Record<string, unknown>[],
  failInvoiceCreate: false,
  failHostUpdate: false,
  planPrice: 25,
  published: 1,
  /** Stripe's own view of each draft's lines (cents), to model real totals. */
  lines: {} as Record<string, number[]>,
  /** Simulate the 2026 Stripe default: lines left off the invoice. */
  dropLines: false,
}));

const db = vi.hoisted(() => {
  const m = {
    host: {
      findUnique: vi.fn(async () => ({
        ...state.host,
        plan: null,
        users: [{ email: "qa@example.com" }],
      })),
      update: vi.fn(async ({ data }: { data: Row }) => {
        if (state.failHostUpdate) throw new Error("db write failed");
        Object.assign(state.host, data);
        return { ...state.host };
      }),
    },
    hostingPlan: {
      findUnique: vi.fn(async () => ({
        id: "plan_branded",
        name: "Branded website",
        isActive: true,
        monthlyPrice: state.planPrice,
        pricingModel: "FLAT",
        minProperties: 1,
        currency: "USD",
      })),
    },
    property: { count: vi.fn(async () => state.published) },
    hostingInvoice: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        if (state.failInvoiceCreate) throw new Error("db insert failed");
        const row = { id: `hi_${state.invoices.length + 1}`, ...data };
        state.invoices.push(row);
        return row;
      }),
    },
    // Real rollback: restore the snapshot when the callback throws.
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      const host = structuredClone(state.host);
      const invoices = structuredClone(state.invoices);
      try {
        return await fn(m);
      } catch (e) {
        state.host = host;
        state.invoices = invoices;
        throw e;
      }
    }),
  };
  return m;
});

const stripe = vi.hoisted(() => ({
  invoiceItems: { create: vi.fn(), del: vi.fn(async (id: string) => ({ id, deleted: true })) },
  invoices: {
    create: vi.fn(),
    retrieve: vi.fn(),
    finalizeInvoice: vi.fn(),
    sendInvoice: vi.fn(async () => ({})),
    voidInvoice: vi.fn(async () => ({})),
    del: vi.fn(async () => ({})),
  },
}));
const card = vi.hoisted(() => ({ onFile: false }));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/stripe", async (orig) => ({
  ...(await orig<typeof import("@/lib/stripe")>()),
  getStripe: () => stripe,
  isStripeConfigured: () => true,
}));
vi.mock("@/lib/platform-billing", () => ({
  ensurePlatformCustomer: vi.fn(async () => "cus_qa"),
  customerHasCardOnFile: vi.fn(async () => card.onFile),
  promoteComplimentaryHostIfPaid: vi.fn(),
  stripeObjectId: (v: unknown) => (typeof v === "string" ? v : null),
}));

import {
  createHostingInvoiceForHost,
  HOSTING_INVOICE_FAILED_ERROR,
  HostingInvoiceRefusedError,
} from "@/lib/hosting-billing";
import { invoiceSkippedNotice } from "@/lib/hosting-billing-notice";

const OLD_START = new Date("2026-10-04T05:00:00Z");
const OLD_END = new Date("2026-11-04T06:00:00Z");

function seed(over: Row = {}) {
  state.host = {
    id: "h_qa2",
    name: "QA Tester Two",
    slug: "qa-tester-two",
    planId: "plan_branded",
    hostingMode: "PLATFORM",
    sitePresence: "CUSTOM",
    approvalStatus: "APPROVED",
    subscriptionStatus: "PENDING_PAYMENT",
    currentPeriodStart: OLD_START,
    currentPeriodEnd: OLD_END,
    stripeCustomerId: "cus_qa",
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
    pricingIntelligenceAddonStatus: "NONE",
    pricingIntelligenceAddonAmount: null,
    billingEmail: "qa@example.com",
    contactEmail: null,
    isTestBrand: false,
    ...over,
  };
  state.invoices = [];
  state.failInvoiceCreate = false;
  state.failHostUpdate = false;
}

let itemN = 0;
beforeEach(() => {
  vi.clearAllMocks();
  seed();
  card.onFile = false;
  itemN = 0;
  state.planPrice = 25;
  state.published = 1;
  state.lines = {};
  state.dropLines = false;
  const total = (id: string) => (state.lines[id] || []).reduce((a, b) => a + b, 0);
  stripe.invoiceItems.create.mockImplementation(
    async (p: { invoice?: string; amount: number }) => {
      // Like Stripe: an item with no invoice stays pending (not on any invoice).
      if (p.invoice && !state.dropLines) {
        (state.lines[p.invoice] ||= []).push(p.amount);
      }
      return { id: `ii_${++itemN}` };
    },
  );
  stripe.invoices.create.mockImplementation(async () => ({ id: "in_draft" }));
  stripe.invoices.retrieve.mockImplementation(async (id: string) => ({ id, total: total(id) }));
  stripe.invoices.finalizeInvoice.mockImplementation(async (id: string) => ({
    id,
    total: total(id),
    // Stripe marks a $0 invoice paid on finalize, whatever the method.
    status: card.onFile || total(id) === 0 ? "paid" : "open",
    hosted_invoice_url: "https://invoice.example/x",
  }));
});

const unchanged = () => {
  expect(state.host.subscriptionStatus).toBe("PENDING_PAYMENT");
  expect(state.host.currentPeriodStart).toEqual(OLD_START);
  expect(state.host.currentPeriodEnd).toEqual(OLD_END);
  expect(state.invoices).toHaveLength(0);
};

describe("a failed renewal invoice leaves the brand unchanged", () => {
  it("Stripe fails on a line item: error, brand not ACTIVE, period not moved, draft deleted", async () => {
    stripe.invoiceItems.create
      .mockImplementationOnce(async () => ({ id: "ii_1" }))
      .mockRejectedValueOnce(new Error("stripe down"));
    await expect(createHostingInvoiceForHost({ hostId: "h_qa2" })).rejects.toThrow(
      HOSTING_INVOICE_FAILED_ERROR,
    );
    unchanged();
    expect(db.host.update).not.toHaveBeenCalled();
    expect(stripe.invoices.del).toHaveBeenCalledWith("in_draft");
    expect(stripe.invoices.finalizeInvoice).not.toHaveBeenCalled();
  });

  it("Stripe fails to create the invoice: no line items made, brand unchanged", async () => {
    stripe.invoices.create.mockRejectedValueOnce(new Error("bad request"));
    await expect(createHostingInvoiceForHost({ hostId: "h_qa2" })).rejects.toThrow(
      HOSTING_INVOICE_FAILED_ERROR,
    );
    unchanged();
    expect(stripe.invoiceItems.create).not.toHaveBeenCalled();
  });

  it("Stripe fails to finalize: the draft is deleted, nothing sent, brand unchanged", async () => {
    stripe.invoices.finalizeInvoice.mockRejectedValueOnce(new Error("finalize failed"));
    await expect(createHostingInvoiceForHost({ hostId: "h_qa2" })).rejects.toThrow(
      HOSTING_INVOICE_FAILED_ERROR,
    );
    unchanged();
    expect(stripe.invoices.del).toHaveBeenCalledWith("in_draft");
    expect(stripe.invoices.sendInvoice).not.toHaveBeenCalled();
  });

  it("saving the invoice row fails: brand unchanged and the open Stripe invoice is voided", async () => {
    state.failInvoiceCreate = true;
    await expect(createHostingInvoiceForHost({ hostId: "h_qa2" })).rejects.toThrow("db insert failed");
    unchanged();
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledWith("in_draft");
  });

  it("updating the brand fails: the invoice row rolls back too, Stripe invoice voided", async () => {
    state.failHostUpdate = true;
    await expect(createHostingInvoiceForHost({ hostId: "h_qa2" })).rejects.toThrow("db write failed");
    unchanged();
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledWith("in_draft");
  });

  it("an ACTIVE brand whose invoice fails stays ACTIVE with the same period (no change either way)", async () => {
    seed({ subscriptionStatus: "ACTIVE" });
    stripe.invoices.create.mockRejectedValueOnce(new Error("bad request"));
    await expect(createHostingInvoiceForHost({ hostId: "h_qa2" })).rejects.toThrow();
    expect(state.host.subscriptionStatus).toBe("ACTIVE");
    expect(state.host.currentPeriodEnd).toEqual(OLD_END);
  });
});

describe("successful invoices", () => {
  it("open (unpaid) invoice: saved OPEN, brand stays PENDING_PAYMENT, period not moved", async () => {
    const rec = await createHostingInvoiceForHost({ hostId: "h_qa2" });
    expect(rec.status).toBe("OPEN");
    expect(state.invoices).toHaveLength(1);
    expect(state.host.subscriptionStatus).toBe("PENDING_PAYMENT");
    expect(state.host.currentPeriodEnd).toEqual(OLD_END);
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
  });

  it("paid at once by the card on file: ACTIVE and the period moves forward", async () => {
    card.onFile = true;
    const rec = await createHostingInvoiceForHost({ hostId: "h_qa2" });
    expect(rec.status).toBe("PAID");
    expect(state.host.subscriptionStatus).toBe("ACTIVE");
    expect((state.host.currentPeriodEnd as Date).getTime()).toBeGreaterThan(OLD_END.getTime());
  });
});

describe("T50b: a $0 invoice never activates a paid plan", () => {
  it("line items go on the draft invoice itself (not left pending)", async () => {
    await createHostingInvoiceForHost({ hostId: "h_qa2" });
    expect(stripe.invoices.create.mock.calls[0][0]).toMatchObject({
      pending_invoice_items_behavior: "exclude",
    });
    for (const [p] of stripe.invoiceItems.create.mock.calls) {
      expect(p).toMatchObject({ invoice: "in_draft" });
    }
    // Branded $25 plus the card processing line, so Stripe's total is > $25.
    expect(state.lines.in_draft[0]).toBe(2500);
    expect(state.lines.in_draft.reduce((a, b) => a + b, 0)).toBeGreaterThan(2500);
  });

  it("the 6:07 PM case: Stripe total is $0 on Branded $25 — refused before finalize, nothing emailed, brand unchanged", async () => {
    state.dropLines = true;
    await expect(createHostingInvoiceForHost({ hostId: "h_qa2" })).rejects.toBeInstanceOf(
      HostingInvoiceRefusedError,
    );
    unchanged();
    expect(stripe.invoices.finalizeInvoice).not.toHaveBeenCalled();
    expect(stripe.invoices.sendInvoice).not.toHaveBeenCalled();
    expect(stripe.invoices.del).toHaveBeenCalledWith("in_draft");
  });

  it("an ACTIVE brand stays ACTIVE with the same period when the total is $0", async () => {
    seed({ subscriptionStatus: "ACTIVE" });
    state.dropLines = true;
    await expect(createHostingInvoiceForHost({ hostId: "h_qa2" })).rejects.toBeInstanceOf(
      HostingInvoiceRefusedError,
    );
    expect(state.host.currentPeriodEnd).toEqual(OLD_END);
    expect(state.invoices).toHaveLength(0);
  });

  it("Stripe says paid but for less than owed: not treated as paid, brand unchanged", async () => {
    stripe.invoices.finalizeInvoice.mockImplementationOnce(async (id: string) => ({
      id,
      total: 0,
      status: "paid",
      hosted_invoice_url: null,
    }));
    await expect(createHostingInvoiceForHost({ hostId: "h_qa2" })).rejects.toBeInstanceOf(
      HostingInvoiceRefusedError,
    );
    unchanged();
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
  });

  it("a paid plan that works out to $0 is refused before Stripe is called", async () => {
    // e.g. a per-listing price with no billable listings
    const { calculateHostingAmount } = await import("@/lib/hosting");
    expect(
      calculateHostingAmount({ monthlyPrice: 12, pricingModel: "PER_PROPERTY", minProperties: 0 }, 0)
        .amount,
    ).toBe(0);
    db.hostingPlan.findUnique.mockImplementationOnce(async () => ({
      id: "plan_market",
      name: "Marketplace",
      isActive: true,
      monthlyPrice: 12,
      pricingModel: "PER_PROPERTY",
      minProperties: 0,
      currency: "USD",
    }));
    state.published = 0;
    await expect(createHostingInvoiceForHost({ hostId: "h_qa2" })).rejects.toBeInstanceOf(
      HostingInvoiceRefusedError,
    );
    unchanged();
    expect(stripe.invoices.create).not.toHaveBeenCalled();
    expect(stripe.invoiceItems.create).not.toHaveBeenCalled();
  });

  it("a genuinely free (complimentary) plan is still recorded paid with no Stripe call", async () => {
    state.planPrice = 0;
    const rec = await createHostingInvoiceForHost({ hostId: "h_qa2" });
    expect(rec.status).toBe("PAID");
    expect(state.host.subscriptionStatus).toBe("ACTIVE");
    expect(stripe.invoices.create).not.toHaveBeenCalled();
  });

  it("notice for a refused $0 invoice", () => {
    expect(invoiceSkippedNotice("zero", "qa-tester-two")).toMatch(
      /^No invoice was sent for qa-tester-two: it came to \$0 .*Nothing was billed and the brand's status and billing period were not changed\./,
    );
    expect(invoiceSkippedNotice("zero-approved", "qa-tester-two")).toMatch(/^qa-tester-two is approved\. No invoice/);
  });
});

describe("admin notice", () => {
  it("says nothing was billed or changed", () => {
    expect(invoiceSkippedNotice("failed", "qa-tester-two")).toMatch(
      /^The invoice for qa-tester-two was not created\. Nothing was billed and the brand's status and billing period were not changed\./,
    );
    expect(invoiceSkippedNotice("failed-approved", "qa-tester-two")).toMatch(/^qa-tester-two is approved\. The invoice/);
  });
});
