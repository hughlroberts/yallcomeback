/**
 * Host and guest tax records. Yall Come Back does not file or remit tax.
 * These exports are bookkeeping worksheets, not IRS or state forms.
 */

import type { HostAccess } from "@/lib/scope";
import { bookingScopeWhere } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { parseTaxBreakdown } from "@/lib/tax";

export const TAX_EXPORT_DISCLAIMER =
  "Yall Come Back does not file, withhold, or remit tax. This worksheet is for your records. It is not a tax form. Confirm amounts with your books and a tax professional.";

const BOOKING_STATUSES = ["CONFIRMED", "COMPLETED"] as const;

export type TaxYearKind = "stay" | "payment";

export type StayTaxRow = {
  bookingId: string;
  status: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guestName: string;
  listing: string;
  city: string;
  region: string;
  country: string;
  lodging: number;
  cleaning: number;
  pet: number;
  tax: number;
  total: number;
  paid: number;
  taxLines: { name: string; ratePercent: number; amount: number }[];
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function yearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

export function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvFile(
  filename: string,
  header: string[],
  rows: (string | number)[][],
): { filename: string; body: string } {
  const lines = [
    header.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ];
  return { filename, body: lines.join("\n") + "\n" };
}

export function availableTaxYears(): number[] {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2, y - 3, y - 4];
}

async function loadStayBookings(access: HostAccess, year: number) {
  const { start, end } = yearRange(year);
  return prisma.booking.findMany({
    where: {
      ...bookingScopeWhere(access),
      status: { in: [...BOOKING_STATUSES] },
      checkIn: { gte: start, lt: end },
    },
    include: {
      property: {
        select: {
          title: true,
          city: true,
          region: true,
          country: true,
        },
      },
      payments: true,
    },
    orderBy: { checkIn: "asc" },
  });
}

export function toStayTaxRow(
  b: Awaited<ReturnType<typeof loadStayBookings>>[number],
): StayTaxRow {
  const paid = b.payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);
  return {
    bookingId: b.id,
    status: b.status,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    guestName: b.guestName,
    listing: b.property.title,
    city: b.property.city || "",
    region: b.property.region || "",
    country: b.property.country || "",
    lodging: b.nightlySubtotal,
    cleaning: b.cleaningFee,
    pet: b.petFee,
    tax: b.taxAmount,
    total: b.totalAmount,
    paid,
    taxLines: parseTaxBreakdown(b.taxBreakdown),
  };
}

export async function getHostStayTaxRows(
  access: HostAccess,
  year: number,
): Promise<StayTaxRow[]> {
  const bookings = await loadStayBookings(access, year);
  return bookings.map(toStayTaxRow);
}

export type OccupancyTaxRow = {
  taxName: string;
  ratePercent: number;
  bookingId: string;
  checkIn: Date;
  listing: string;
  city: string;
  region: string;
  nights: number;
  amount: number;
};

export async function getOccupancyTaxRows(
  access: HostAccess,
  year: number,
): Promise<OccupancyTaxRow[]> {
  const stays = await getHostStayTaxRows(access, year);
  const rows: OccupancyTaxRow[] = [];
  for (const s of stays) {
    if (s.taxLines.length === 0 && s.tax > 0) {
      rows.push({
        taxName: "Tax (unspecified line)",
        ratePercent: 0,
        bookingId: s.bookingId,
        checkIn: s.checkIn,
        listing: s.listing,
        city: s.city,
        region: s.region,
        nights: s.nights,
        amount: s.tax,
      });
      continue;
    }
    for (const line of s.taxLines) {
      rows.push({
        taxName: line.name,
        ratePercent: line.ratePercent,
        bookingId: s.bookingId,
        checkIn: s.checkIn,
        listing: s.listing,
        city: s.city,
        region: s.region,
        nights: s.nights,
        amount: line.amount,
      });
    }
  }
  return rows;
}

export type IncomeReceivedRow = {
  paidAt: Date;
  amount: number;
  method: string;
  bookingId: string;
  listing: string;
  city: string;
  region: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  lodging: number;
  cleaning: number;
  pet: number;
  tax: number;
  stayTotal: number;
};

export async function getIncomeReceivedRows(
  access: HostAccess,
  year: number,
): Promise<IncomeReceivedRow[]> {
  const { start, end } = yearRange(year);
  const payments = await prisma.payment.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: start, lt: end },
      booking: bookingScopeWhere(access),
    },
    include: {
      booking: {
        include: {
          property: {
            select: { title: true, city: true, region: true },
          },
        },
      },
    },
    orderBy: { paidAt: "asc" },
  });
  return payments.map((p) => ({
    paidAt: p.paidAt || p.createdAt,
    amount: p.amount,
    method: p.method,
    bookingId: p.booking.id,
    listing: p.booking.property.title,
    city: p.booking.property.city || "",
    region: p.booking.property.region || "",
    guestName: p.booking.guestName,
    checkIn: p.booking.checkIn,
    checkOut: p.booking.checkOut,
    lodging: p.booking.nightlySubtotal,
    cleaning: p.booking.cleaningFee,
    pet: p.booking.petFee,
    tax: p.booking.taxAmount,
    stayTotal: p.booking.totalAmount,
  }));
}

export type TaxYearSummary = {
  year: number;
  stayCount: number;
  nights: number;
  lodging: number;
  cleaning: number;
  pet: number;
  taxCollected: number;
  stayTotal: number;
  amountPaid: number;
  occupancyByLine: { name: string; amount: number }[];
  incomeReceived: number;
  incomeByMethod: { method: string; amount: number; count: number }[];
};

export async function getTaxYearSummary(
  access: HostAccess,
  year: number,
): Promise<TaxYearSummary> {
  const [stays, income] = await Promise.all([
    getHostStayTaxRows(access, year),
    getIncomeReceivedRows(access, year),
  ]);
  const occupancyByLine = new Map<string, number>();
  for (const s of stays) {
    if (s.taxLines.length === 0 && s.tax > 0) {
      occupancyByLine.set(
        "Tax (unspecified line)",
        (occupancyByLine.get("Tax (unspecified line)") || 0) + s.tax,
      );
    }
    for (const line of s.taxLines) {
      occupancyByLine.set(
        line.name,
        (occupancyByLine.get(line.name) || 0) + line.amount,
      );
    }
  }
  const incomeByMethod = new Map<string, { amount: number; count: number }>();
  for (const row of income) {
    const cur = incomeByMethod.get(row.method) || { amount: 0, count: 0 };
    cur.amount += row.amount;
    cur.count += 1;
    incomeByMethod.set(row.method, cur);
  }
  return {
    year,
    stayCount: stays.length,
    nights: stays.reduce((s, r) => s + r.nights, 0),
    lodging: stays.reduce((s, r) => s + r.lodging, 0),
    cleaning: stays.reduce((s, r) => s + r.cleaning, 0),
    pet: stays.reduce((s, r) => s + r.pet, 0),
    taxCollected: stays.reduce((s, r) => s + r.tax, 0),
    stayTotal: stays.reduce((s, r) => s + r.total, 0),
    amountPaid: stays.reduce((s, r) => s + r.paid, 0),
    occupancyByLine: [...occupancyByLine.entries()].map(([name, amount]) => ({
      name,
      amount,
    })),
    incomeReceived: income.reduce((s, r) => s + r.amount, 0),
    incomeByMethod: [...incomeByMethod.entries()].map(([method, v]) => ({
      method,
      amount: v.amount,
      count: v.count,
    })),
  };
}

export function stayLedgerCsv(year: number, rows: StayTaxRow[]) {
  return csvFile(
    `ycb-tax-stays-${year}.csv`,
    [
      "booking_id",
      "status",
      "check_in",
      "check_out",
      "nights",
      "guest",
      "listing",
      "city",
      "region",
      "country",
      "lodging_usd",
      "cleaning_usd",
      "pet_usd",
      "tax_usd",
      "stay_total_usd",
      "amount_paid_usd",
      "tax_lines",
    ],
    rows.map((r) => [
      r.bookingId,
      r.status,
      ymd(r.checkIn),
      ymd(r.checkOut),
      r.nights,
      r.guestName,
      r.listing,
      r.city,
      r.region,
      r.country,
      r.lodging.toFixed(2),
      r.cleaning.toFixed(2),
      r.pet.toFixed(2),
      r.tax.toFixed(2),
      r.total.toFixed(2),
      r.paid.toFixed(2),
      r.taxLines
        .map((l) => `${l.name} ${l.ratePercent}% $${l.amount.toFixed(2)}`)
        .join("; "),
    ]),
  );
}

export function occupancyCsv(year: number, rows: OccupancyTaxRow[]) {
  return csvFile(
    `ycb-tax-occupancy-${year}.csv`,
    [
      "tax_name",
      "rate_percent",
      "amount_usd",
      "booking_id",
      "check_in",
      "listing",
      "city",
      "region",
      "nights",
    ],
    rows.map((r) => [
      r.taxName,
      r.ratePercent,
      r.amount.toFixed(2),
      r.bookingId,
      ymd(r.checkIn),
      r.listing,
      r.city,
      r.region,
      r.nights,
    ]),
  );
}

export function incomeCsv(year: number, rows: IncomeReceivedRow[]) {
  return csvFile(
    `ycb-tax-income-received-${year}.csv`,
    [
      "paid_on",
      "amount_received_usd",
      "method",
      "booking_id",
      "guest",
      "listing",
      "city",
      "region",
      "check_in",
      "check_out",
      "lodging_usd",
      "cleaning_usd",
      "pet_usd",
      "tax_on_stay_usd",
      "stay_total_usd",
    ],
    rows.map((r) => [
      ymd(r.paidAt),
      r.amount.toFixed(2),
      r.method,
      r.bookingId,
      r.guestName,
      r.listing,
      r.city,
      r.region,
      ymd(r.checkIn),
      ymd(r.checkOut),
      r.lodging.toFixed(2),
      r.cleaning.toFixed(2),
      r.pet.toFixed(2),
      r.tax.toFixed(2),
      r.stayTotal.toFixed(2),
    ]),
  );
}

export function summaryCsv(
  year: number,
  summary: TaxYearSummary,
  profile: {
    legalName: string;
    entityType: string;
    filingState: string;
  },
) {
  return csvFile(
    `ycb-tax-summary-${year}.csv`,
    ["field", "value"],
    [
      ["disclaimer", TAX_EXPORT_DISCLAIMER],
      ["year", year],
      ["legal_name", profile.legalName],
      ["entity_type", profile.entityType],
      ["filing_state", profile.filingState],
      ["stay_count_check_in_year", summary.stayCount],
      ["nights", summary.nights],
      ["lodging_usd", summary.lodging.toFixed(2)],
      ["cleaning_usd", summary.cleaning.toFixed(2)],
      ["pet_usd", summary.pet.toFixed(2)],
      ["occupancy_tax_collected_usd", summary.taxCollected.toFixed(2)],
      ["stay_total_usd", summary.stayTotal.toFixed(2)],
      ["amount_paid_on_those_stays_usd", summary.amountPaid.toFixed(2)],
      ["income_received_payment_year_usd", summary.incomeReceived.toFixed(2)],
      ...summary.occupancyByLine.map(
        (l) => [`occupancy_tax:${l.name}`, l.amount.toFixed(2)] as (string | number)[],
      ),
      ...summary.incomeByMethod.map(
        (m) =>
          [
            `income_received:${m.method}`,
            `${m.count} payments / $${m.amount.toFixed(2)}`,
          ] as (string | number)[],
      ),
    ],
  );
}

export type GuestStayRow = {
  bookingId: string;
  status: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  listing: string;
  city: string;
  region: string;
  hostName: string;
  lodging: number;
  cleaning: number;
  pet: number;
  tax: number;
  total: number;
  paid: number;
};

export async function getGuestStayRows(
  userId: string,
  email: string | null,
  year: number,
): Promise<GuestStayRow[]> {
  const { start, end } = yearRange(year);
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [{ userId }, ...(email ? [{ guestEmail: email }] : [])],
      checkIn: { gte: start, lt: end },
      status: { in: ["CONFIRMED", "COMPLETED", "PENDING_PAYMENT"] },
    },
    include: {
      property: {
        select: {
          title: true,
          city: true,
          region: true,
          host: { select: { name: true } },
        },
      },
      payments: true,
    },
    orderBy: { checkIn: "asc" },
  });
  return bookings.map((b) => ({
    bookingId: b.id,
    status: b.status,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    listing: b.property.title,
    city: b.property.city || "",
    region: b.property.region || "",
    hostName: b.property.host.name,
    lodging: b.nightlySubtotal,
    cleaning: b.cleaningFee,
    pet: b.petFee,
    tax: b.taxAmount,
    total: b.totalAmount,
    paid: b.payments
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + p.amount, 0),
  }));
}

export function guestStayCsv(year: number, rows: GuestStayRow[]) {
  return csvFile(
    `ycb-my-stays-${year}.csv`,
    [
      "booking_id",
      "status",
      "check_in",
      "check_out",
      "nights",
      "listing",
      "city",
      "region",
      "host",
      "lodging_usd",
      "cleaning_usd",
      "pet_usd",
      "tax_usd",
      "stay_total_usd",
      "amount_you_paid_usd",
    ],
    rows.map((r) => [
      r.bookingId,
      r.status,
      ymd(r.checkIn),
      ymd(r.checkOut),
      r.nights,
      r.listing,
      r.city,
      r.region,
      r.hostName,
      r.lodging.toFixed(2),
      r.cleaning.toFixed(2),
      r.pet.toFixed(2),
      r.tax.toFixed(2),
      r.total.toFixed(2),
      r.paid.toFixed(2),
    ]),
  );
}
