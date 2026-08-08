/**
 * Host earnings aggregates from bookings + deposit payments.
 * Yall Come Back does not run a separate payout ledger yet - “paid” = guest payments
 * marked PAID; “upcoming” = confirmed/pending stays with future check-in.
 */

import { prisma } from "@/lib/db";
import type { HostAccess } from "@/lib/scope";
import { bookingScopeWhere } from "@/lib/scope";
import {
  MONTH_LABELS,
  type MonthlyBucket,
} from "@/lib/earnings-shared";

export type { MonthlyBucket } from "@/lib/earnings-shared";
export { MONTH_LABELS } from "@/lib/earnings-shared";

export type EarningsFilters = {
  /** YYYY or empty */
  year?: string;
  propertyId?: string;
  q?: string;
  method?: string;
};

export type PaidRow = {
  id: string;
  status: "Sent";
  date: Date;
  amount: number;
  methodLabel: string;
  propertyTitle: string;
  propertyId: string;
  guestName: string;
  bookingId: string;
  nights: number;
  checkIn: Date;
  checkOut: Date;
};

export type UpcomingRow = {
  id: string;
  bookingId: string;
  expectedDate: Date;
  amount: number;
  type: "Deposit" | "Stay balance" | "Pending deposit";
  propertyTitle: string;
  propertyId: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
};

function paymentMethodLabel(method: string, notes?: string | null): string {
  switch (method) {
    case "STRIPE":
      return "Card (Stripe)";
    case "BITCOIN":
      return "Bitcoin";
    case "MANUAL":
      return notes?.includes("Bitcoin") ? "Bitcoin (manual)" : "Manual / bank";
    default:
      return method;
  }
}

export async function getHostListings(access: HostAccess) {
  const { propertyScopeWhere } = await import("@/lib/scope");
  return prisma.property.findMany({
    where: propertyScopeWhere(access),
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}

export async function getPaidEarnings(
  access: HostAccess,
  filters: EarningsFilters = {},
): Promise<PaidRow[]> {
  const payments = await prisma.payment.findMany({
    where: {
      status: "PAID",
      booking: {
        ...bookingScopeWhere(access),
        ...(filters.propertyId
          ? { propertyId: filters.propertyId }
          : {}),
      },
      ...(filters.method && filters.method !== "all"
        ? { method: filters.method as "STRIPE" | "MANUAL" | "BITCOIN" }
        : {}),
    },
    include: {
      booking: {
        include: {
          property: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  let rows: PaidRow[] = payments.map((p) => ({
    id: p.id,
    status: "Sent" as const,
    date: p.paidAt || p.createdAt,
    amount: p.amount,
    methodLabel: paymentMethodLabel(p.method, p.notes),
    propertyTitle: p.booking.property.title,
    propertyId: p.booking.property.id,
    guestName: p.booking.guestName,
    bookingId: p.booking.id,
    nights: p.booking.nights,
    checkIn: p.booking.checkIn,
    checkOut: p.booking.checkOut,
  }));

  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.guestName.toLowerCase().includes(q) ||
        r.propertyTitle.toLowerCase().includes(q) ||
        r.bookingId.toLowerCase().includes(q) ||
        r.methodLabel.toLowerCase().includes(q),
    );
  }

  if (filters.year) {
    const y = Number(filters.year);
    if (Number.isFinite(y)) {
      rows = rows.filter((r) => r.date.getFullYear() === y);
    }
  }

  return rows;
}

export async function getUpcomingEarnings(
  access: HostAccess,
  filters: EarningsFilters = {},
): Promise<UpcomingRow[]> {
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      ...bookingScopeWhere(access),
      status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
      checkIn: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) },
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
    },
    include: {
      property: { select: { id: true, title: true } },
      payments: true,
    },
    orderBy: { checkIn: "asc" },
    take: 100,
  });

  const rows: UpcomingRow[] = [];

  for (const b of bookings) {
    const paidSum = b.payments
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + p.amount, 0);
    const pendingPayments = b.payments.filter((p) => p.status === "PENDING");

    if (pendingPayments.length > 0) {
      for (const p of pendingPayments) {
        rows.push({
          id: p.id,
          bookingId: b.id,
          expectedDate: b.checkIn,
          amount: p.amount,
          type: "Pending deposit",
          propertyTitle: b.property.title,
          propertyId: b.property.id,
          guestName: b.guestName,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          status: b.status,
        });
      }
    }

    const remaining = Math.max(0, b.totalAmount - paidSum);
    if (remaining > 0.01 && b.status === "CONFIRMED") {
      rows.push({
        id: `balance-${b.id}`,
        bookingId: b.id,
        expectedDate: b.checkIn,
        amount: remaining,
        type: paidSum > 0 ? "Stay balance" : "Deposit",
        propertyTitle: b.property.title,
        propertyId: b.property.id,
        guestName: b.guestName,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        status: b.status,
      });
    }
  }

  let filtered = rows;
  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.guestName.toLowerCase().includes(q) ||
        r.propertyTitle.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q),
    );
  }
  if (filters.year) {
    const y = Number(filters.year);
    if (Number.isFinite(y)) {
      filtered = filtered.filter((r) => r.expectedDate.getFullYear() === y);
    }
  }

  return filtered;
}

export async function getMonthlyPerformance(
  access: HostAccess,
  year: number,
): Promise<MonthlyBucket[]> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const paidPayments = await prisma.payment.findMany({
    where: {
      status: "PAID",
      booking: bookingScopeWhere(access),
      OR: [
        { paidAt: { gte: start, lt: end } },
        {
          paidAt: null,
          createdAt: { gte: start, lt: end },
        },
      ],
    },
    select: { amount: true, paidAt: true, createdAt: true },
  });

  const upcomingBookings = await prisma.booking.findMany({
    where: {
      ...bookingScopeWhere(access),
      status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
      checkIn: { gte: start, lt: end },
    },
    include: { payments: true },
  });

  const buckets: MonthlyBucket[] = [...MONTH_LABELS].map((label, month) => ({
    month,
    label,
    paid: 0,
    upcoming: 0,
    total: 0,
  }));

  for (const p of paidPayments) {
    const d = p.paidAt || p.createdAt;
    if (d.getFullYear() !== year) continue;
    buckets[d.getMonth()].paid += p.amount;
  }

  for (const b of upcomingBookings) {
    const paidSum = b.payments
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, b.totalAmount - paidSum);
    if (remaining > 0) {
      buckets[b.checkIn.getMonth()].upcoming += remaining;
    }
  }

  for (const b of buckets) {
    b.total = b.paid + b.upcoming;
  }

  return buckets;
}

export async function getPerformanceSummary(
  access: HostAccess,
  year: number,
  month: number,
) {
  const buckets = await getMonthlyPerformance(access, year);
  const current = buckets[month] || {
    paid: 0,
    upcoming: 0,
    total: 0,
    label: MONTH_LABELS[month],
    month,
  };
  const yearPaid = buckets.reduce((s, b) => s + b.paid, 0);
  const yearUpcoming = buckets.reduce((s, b) => s + b.upcoming, 0);
  return { current, yearPaid, yearUpcoming, yearTotal: yearPaid + yearUpcoming, buckets };
}

export function availableYears(): number[] {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2];
}
