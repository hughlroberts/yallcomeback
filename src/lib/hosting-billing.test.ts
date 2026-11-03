import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const m = {
    hostingInvoice: { findUnique: vi.fn(), update: vi.fn() },
    host: { findUnique: vi.fn(), update: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({})) },
    $transaction: vi.fn(),
  };
  m.$transaction.mockImplementation(async (fn: (tx: typeof m) => unknown) => fn(m));
  return m;
});
vi.mock("@/lib/db", () => ({ prisma: db }));

import {
  hostingPeriodAfterPayment,
  markHostingInvoicePaid,
  paysByCardMonthly,
} from "@/lib/hosting-billing";
import { invoiceSkippedNotice } from "@/lib/hosting-billing-notice";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe("hostingPeriodAfterPayment", () => {
  it("keeps a current invoice period", () => {
    const p = hostingPeriodAfterPayment({
      invoicePeriodStart: d("2026-10-30"),
      invoicePeriodEnd: d("2026-11-30"),
      paidAt: d("2026-10-30"),
    });
    expect(p.end).toEqual(d("2026-11-30"));
  });

  it("late payment on a stale period (Aug 30 - Sept 30, paid Oct 30) runs a month from payment", () => {
    const p = hostingPeriodAfterPayment({
      currentPeriodEnd: d("2026-08-30"),
      invoicePeriodStart: d("2026-08-30"),
      invoicePeriodEnd: d("2026-09-30"),
      paidAt: d("2026-10-30"),
    });
    expect(p.start).toEqual(d("2026-10-30"));
    expect(p.end.getTime()).toBeGreaterThan(d("2026-11-29").getTime());
  });

  it("zero-length invoice period (one-off invoice) runs a month from payment", () => {
    const p = hostingPeriodAfterPayment({
      invoicePeriodStart: d("2026-10-30"),
      invoicePeriodEnd: d("2026-10-30"),
      paidAt: d("2026-10-30"),
    });
    expect(p.end.getTime()).toBeGreaterThan(d("2026-11-29").getTime());
  });

  it("never moves the period end backwards", () => {
    const p = hostingPeriodAfterPayment({
      currentPeriodStart: d("2026-11-30"),
      currentPeriodEnd: d("2026-12-30"),
      invoicePeriodStart: d("2026-10-30"),
      invoicePeriodEnd: d("2026-11-30"),
      paidAt: d("2026-10-30"),
    });
    expect(p.end).toEqual(d("2026-12-30"));
  });
});

describe("markHostingInvoicePaid", () => {
  beforeEach(() => {
    db.hostingInvoice.update.mockReset().mockImplementation(async (a: { data: object }) => a.data);
    db.host.update.mockClear();
    db.host.findUnique.mockResolvedValue({
      currentPeriodStart: d("2026-08-30"),
      currentPeriodEnd: d("2026-09-30"),
    });
  });

  it("advances a stale Sept 30 period end past the Oct 30 payment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(d("2026-10-30"));
    db.hostingInvoice.findUnique.mockResolvedValue({
      id: "inv1", hostId: "host_cherokee", status: "OPEN", paidAt: null,
      periodStart: d("2026-08-30"), periodEnd: d("2026-09-30"),
    });
    await markHostingInvoicePaid("inv1");
    vi.useRealTimers();
    const data = (db.host.update.mock.calls[0]![0] as { data: { currentPeriodEnd: Date } }).data;
    expect(data.currentPeriodEnd.getTime()).toBeGreaterThan(d("2026-11-29").getTime());
  });

  it("an invoice already PAID still applies its period (idempotent, no second invoice write)", async () => {
    db.hostingInvoice.findUnique.mockResolvedValue({
      id: "inv2", hostId: "host_cherokee", status: "PAID", paidAt: d("2026-10-30"),
      periodStart: d("2026-10-30"), periodEnd: d("2026-11-30"),
    });
    await markHostingInvoicePaid("inv2");
    await markHostingInvoicePaid("inv2");
    expect(db.hostingInvoice.update).not.toHaveBeenCalled();
    for (const c of db.host.update.mock.calls) {
      expect((c[0] as { data: { currentPeriodEnd: Date } }).data.currentPeriodEnd).toEqual(d("2026-11-30"));
    }
  });
});

describe("invoice skipped for card-paying Marketplace brands (T46)", () => {
  const market = {
    hostingMode: "PLATFORM",
    sitePresence: "STAYLOCAL",
    stripeSubscriptionId: "sub_1",
    stripeSubscriptionStatus: "active",
  };
  it("a live Marketplace card subscription pays by card", () => {
    expect(paysByCardMonthly(market)).toBe(true);
    expect(paysByCardMonthly({ ...market, stripeSubscriptionStatus: "past_due" })).toBe(true);
  });
  it("no card, ended card, or Branded: an invoice is allowed", () => {
    expect(paysByCardMonthly({ ...market, stripeSubscriptionId: null })).toBe(false);
    expect(paysByCardMonthly({ ...market, stripeSubscriptionStatus: "canceled" })).toBe(false);
    expect(paysByCardMonthly({ ...market, sitePresence: "CUSTOM" })).toBe(false);
  });
  it("notice text names the brand and says why", () => {
    expect(invoiceSkippedNotice("approved", "QA Marketplace Test")).toBe(
      "QA Marketplace Test is approved. No invoice was sent: QA Marketplace Test already pays by card each month, so an invoice would bill it twice.",
    );
    expect(invoiceSkippedNotice("invoice", "")).toMatch(/^No invoice was sent: This brand/);
    expect(invoiceSkippedNotice("other", "QA")).toBeNull();
    expect(invoiceSkippedNotice(null, "QA")).toBeNull();
  });
});

describe("renewal invoice refused for a card-paying Marketplace brand (T46 follow-up)", () => {
  it("createHostingInvoiceForHost throws the card-billed error and writes nothing", async () => {
    const { createHostingInvoiceForHost, CARD_BILLED_INVOICE_ERROR } = await import(
      "@/lib/hosting-billing"
    );
    db.host.findUnique.mockResolvedValueOnce({
      id: "h1",
      name: "QA Marketplace Test",
      planId: "plan_1",
      hostingMode: "PLATFORM",
      sitePresence: "STAYLOCAL",
      stripeSubscriptionId: "sub_1",
      stripeSubscriptionStatus: "active",
    });
    db.host.update.mockClear();
    db.hostingInvoice.update.mockClear();
    db.$transaction.mockClear();
    await expect(createHostingInvoiceForHost({ hostId: "h1" })).rejects.toThrow(
      CARD_BILLED_INVOICE_ERROR,
    );
    expect(db.host.update).not.toHaveBeenCalled();
    expect(db.hostingInvoice.update).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
