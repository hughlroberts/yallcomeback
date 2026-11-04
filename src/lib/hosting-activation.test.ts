import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const m = {
    hostingInvoice: { findUnique: vi.fn(), update: vi.fn(async () => ({ id: "inv" })) },
    host: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
    $transaction: vi.fn(),
  };
  m.$transaction.mockImplementation(async (fn: (tx: typeof m) => unknown) => fn(m));
  return m;
});
vi.mock("@/lib/db", () => ({ prisma: db }));

import { invoicePaymentActivatesHosting, statusWithoutActivation } from "./hosting-activation";
import { markHostingInvoicePaid } from "./hosting-billing";

const inv = (amount: number) => ({
  id: "inv", hostId: "h_qa", status: "OPEN", paidAt: null, amount,
  periodStart: new Date("2026-11-01"), periodEnd: new Date("2026-12-01"),
});

beforeEach(() => vi.clearAllMocks());

describe("T48(2) invoicePaymentActivatesHosting", () => {
  it("only a paid amount > 0 on a real brand activates", () => {
    expect(invoicePaymentActivatesHosting({ amount: 30 }, { isTestBrand: false })).toBe(true);
    expect(invoicePaymentActivatesHosting({ amount: 0 }, { isTestBrand: false })).toBe(false);
    expect(invoicePaymentActivatesHosting({ amount: null }, { isTestBrand: false })).toBe(false);
    expect(invoicePaymentActivatesHosting({ amount: 30 }, { isTestBrand: true })).toBe(false);
    expect(invoicePaymentActivatesHosting({ amount: 30 }, null)).toBe(false);
  });
  it("without activation an ACTIVE brand stays ACTIVE, anything else is PENDING_PAYMENT", () => {
    expect(statusWithoutActivation("ACTIVE")).toBe("ACTIVE");
    for (const s of ["PENDING_PAYMENT", "PAST_DUE", "TRIALING", null]) {
      expect(statusWithoutActivation(s)).toBe("PENDING_PAYMENT");
    }
  });
});

describe("T48(2) invoice.paid webhook path (markHostingInvoicePaid)", () => {
  it("$0 invoice: invoice marked PAID, brand NOT activated", async () => {
    db.hostingInvoice.findUnique.mockResolvedValue(inv(0));
    db.host.findUnique.mockResolvedValue({ isTestBrand: false });
    await markHostingInvoicePaid("inv");
    expect(db.hostingInvoice.update).toHaveBeenCalled();
    expect(db.host.update).not.toHaveBeenCalled();
  });
  it("test brand: paid invoice never activates", async () => {
    db.hostingInvoice.findUnique.mockResolvedValue(inv(30));
    db.host.findUnique.mockResolvedValue({ isTestBrand: true });
    await markHostingInvoicePaid("inv");
    expect(db.host.update).not.toHaveBeenCalled();
  });
  it("real brand, real amount: activates", async () => {
    db.hostingInvoice.findUnique.mockResolvedValue(inv(30));
    db.host.findUnique.mockResolvedValue({ isTestBrand: false });
    await markHostingInvoicePaid("inv");
    expect(db.host.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "ACTIVE" }) }),
    );
  });
});
