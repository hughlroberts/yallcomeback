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
} from "@/lib/hosting-billing";

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
