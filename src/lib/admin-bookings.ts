/**
 * One list for /admin/bookings: online bookings plus direct (manual /
 * offline) stays the host logged from the calendar as CalendarBlocks.
 * Pure helpers so the page and tests share the same rules.
 */
import type { PaymentMethod } from "@prisma/client";
import { paymentMethodLabel as hostPaymentLabel } from "@/lib/host-payments";

export type AdminBookingKind = "online" | "direct";

export type AdminBookingRow = {
  kind: AdminBookingKind;
  id: string;
  href: string;
  guestName: string;
  propertyTitle: string;
  /** YYYY-MM-DD */
  checkIn: string;
  /** YYYY-MM-DD (checkout day) */
  checkOut: string;
  guests: number | null;
  amount: number | null;
  paid: boolean;
  /** Short status label for the badge */
  status: string;
  paymentMethod: string | null;
  channel: string;
};

/** Block types that are guest stays (not owner use or maintenance). */
export const DIRECT_BOOKING_BLOCK_TYPES = ["OFFLINE", "FRIENDS"] as const;

type BlockLike = {
  id: string;
  source: string;
  blockType: string | null;
  startDate: Date;
  endDate: Date;
  occupantName: string | null;
  guestCount: number | null;
  paymentMethod: string | null;
  invoiceAmount: number | null;
  invoiceStatus: string;
  invoicePaidAt: Date | null;
  bookingId: string | null;
  property: { title: string };
};

type BookingLike = {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  totalAmount: number;
  status: string;
  sourceChannel: string | null;
  property: { title: string };
  payments: { status: string }[];
};

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * A manual calendar block counts as a direct booking when it is a guest
 * stay (Offline / Friends & family) or carries booking data (payment
 * method or amount). Owner and maintenance holds without money stay off.
 */
export function isDirectBookingBlock(b: {
  source: string;
  blockType: string | null;
  bookingId: string | null;
  paymentMethod: string | null;
  invoiceAmount: number | null;
}): boolean {
  if (b.source !== "MANUAL") return false;
  if (b.bookingId) return false; // mirrors an online booking
  if (
    (DIRECT_BOOKING_BLOCK_TYPES as readonly string[]).includes(
      b.blockType ?? "",
    )
  ) {
    return true;
  }
  return Boolean(b.paymentMethod) || (b.invoiceAmount ?? 0) > 0;
}

/** Prisma where for the candidate blocks (refined by isDirectBookingBlock). */
export function directBookingBlockWhere() {
  return {
    source: "MANUAL" as const,
    bookingId: null,
    OR: [
      { blockType: { in: [...DIRECT_BOOKING_BLOCK_TYPES] } },
      { paymentMethod: { not: null } },
      { invoiceAmount: { gt: 0 } },
    ],
  };
}

export function blockIsPaid(b: {
  invoiceStatus: string;
  invoicePaidAt: Date | null;
}): boolean {
  return b.invoiceStatus === "PAID" || b.invoicePaidAt != null;
}

export function directPaymentLabel(m: string | null | undefined): string {
  if (!m) return "Not set";
  return hostPaymentLabel(m as PaymentMethod);
}

export function blockTypeLabel(t: string | null | undefined): string {
  switch (t) {
    case "OFFLINE":
      return "Offline booking";
    case "FRIENDS":
      return "Friends & family";
    case "OWNER":
      return "Owner stay";
    case "MAINTENANCE":
      return "Maintenance";
    default:
      return "Manual booking";
  }
}

export function onlineBookingRow(b: BookingLike): AdminBookingRow {
  return {
    kind: "online",
    id: b.id,
    href: `/admin/bookings/${b.id}`,
    guestName: b.guestName,
    propertyTitle: b.property.title,
    checkIn: ymdUtc(b.checkIn),
    checkOut: ymdUtc(b.checkOut),
    guests: b.guests,
    amount: b.totalAmount,
    paid:
      b.status === "COMPLETED" || b.payments.some((p) => p.status === "PAID"),
    status: b.status.replaceAll("_", " "),
    paymentMethod: null,
    channel: b.sourceChannel || "Online",
  };
}

export function directBookingRow(b: BlockLike): AdminBookingRow {
  const paid = blockIsPaid(b);
  return {
    kind: "direct",
    id: b.id,
    href: `/admin/bookings/direct/${b.id}`,
    guestName: b.occupantName?.trim() || blockTypeLabel(b.blockType),
    propertyTitle: b.property.title,
    checkIn: ymdUtc(b.startDate),
    checkOut: ymdUtc(b.endDate),
    guests: b.guestCount,
    amount: b.invoiceAmount,
    paid,
    status: paid ? "PAID" : b.invoiceAmount ? "UNPAID" : "DIRECT",
    paymentMethod: b.paymentMethod,
    channel: blockTypeLabel(b.blockType),
  };
}

/**
 * Upcoming = checkout today or later (includes stays in progress), soonest
 * check-in first. Past = checked out before today, most recent first.
 */
export function splitUpcomingPast(
  rows: AdminBookingRow[],
  todayYmd: string,
): { upcoming: AdminBookingRow[]; past: AdminBookingRow[] } {
  const upcoming = rows
    .filter((r) => r.checkOut >= todayYmd)
    .sort(
      (a, b) => a.checkIn.localeCompare(b.checkIn) || a.id.localeCompare(b.id),
    );
  const past = rows
    .filter((r) => r.checkOut < todayYmd)
    .sort(
      (a, b) => b.checkIn.localeCompare(a.checkIn) || a.id.localeCompare(b.id),
    );
  return { upcoming, past };
}

export function buildAdminBookingRows(
  bookings: BookingLike[],
  blocks: BlockLike[],
): AdminBookingRow[] {
  return [
    ...bookings.map(onlineBookingRow),
    ...blocks.filter(isDirectBookingBlock).map(directBookingRow),
  ];
}

export function parseBookingsView(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "past" ? "past" : "upcoming";
}
