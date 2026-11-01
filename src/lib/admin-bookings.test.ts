import { describe, expect, it } from "vitest";
import {
  blockIsPaid,
  buildAdminBookingRows,
  isDirectBookingBlock,
  parseBookingsView,
  splitUpcomingPast,
} from "./admin-bookings";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

function block(
  over: Partial<Parameters<typeof isDirectBookingBlock>[0]> &
    Record<string, unknown> = {},
) {
  return {
    id: "b1",
    source: "MANUAL",
    blockType: "OFFLINE",
    startDate: d("2026-11-06"),
    endDate: d("2026-11-08"),
    occupantName: "Jane Smith",
    guestCount: 4,
    paymentMethod: "MANUAL",
    invoiceAmount: 400,
    invoiceStatus: "NONE",
    invoicePaidAt: null as Date | null,
    bookingId: null as string | null,
    property: { title: "Lake House" },
    ...over,
  };
}

function booking(over: Record<string, unknown> = {}) {
  return {
    id: "k1",
    guestName: "Online Guest",
    checkIn: d("2026-12-01"),
    checkOut: d("2026-12-03"),
    guests: 2,
    totalAmount: 500,
    status: "CONFIRMED",
    sourceChannel: "MARKETPLACE",
    property: { title: "Lake House" },
    payments: [] as { status: string }[],
    ...over,
  };
}

describe("isDirectBookingBlock", () => {
  it("includes offline and friends stays from the calendar", () => {
    expect(isDirectBookingBlock(block())).toBe(true);
    expect(
      isDirectBookingBlock(
        block({
          blockType: "FRIENDS",
          paymentMethod: null,
          invoiceAmount: null,
        }),
      ),
    ).toBe(true);
  });
  it("includes any manual block that carries money", () => {
    expect(
      isDirectBookingBlock(block({ blockType: "OTHER", paymentMethod: null })),
    ).toBe(true);
  });
  it("leaves out owner/maintenance holds, iCal imports and booking mirrors", () => {
    expect(
      isDirectBookingBlock(
        block({ blockType: "OWNER", paymentMethod: null, invoiceAmount: null }),
      ),
    ).toBe(false);
    expect(isDirectBookingBlock(block({ source: "ICAL_IMPORT" }))).toBe(false);
    expect(isDirectBookingBlock(block({ bookingId: "k1" }))).toBe(false);
  });
});

describe("blockIsPaid", () => {
  it("is paid by status or paid date", () => {
    expect(blockIsPaid({ invoiceStatus: "PAID", invoicePaidAt: null })).toBe(
      true,
    );
    expect(
      blockIsPaid({ invoiceStatus: "OPEN", invoicePaidAt: new Date() }),
    ).toBe(true);
    expect(blockIsPaid({ invoiceStatus: "OPEN", invoicePaidAt: null })).toBe(
      false,
    );
  });
});

describe("buildAdminBookingRows", () => {
  it("lists direct bookings alongside online ones with their own details link", () => {
    const rows = buildAdminBookingRows(
      [booking()],
      [
        block(),
        block({
          id: "b2",
          blockType: "OWNER",
          paymentMethod: null,
          invoiceAmount: null,
        }),
      ],
    );
    expect(rows).toHaveLength(2);
    const direct = rows.find((r) => r.kind === "direct")!;
    expect(direct).toMatchObject({
      href: "/admin/bookings/direct/b1",
      guestName: "Jane Smith",
      checkIn: "2026-11-06",
      checkOut: "2026-11-08",
      guests: 4,
      amount: 400,
      paid: false,
      status: "UNPAID",
    });
    const online = rows.find((r) => r.kind === "online")!;
    expect(online.href).toBe("/admin/bookings/k1");
  });

  it("shows PAID for a paid direct booking", () => {
    const [row] = buildAdminBookingRows([], [block({ invoiceStatus: "PAID" })]);
    expect(row!.paid).toBe(true);
    expect(row!.status).toBe("PAID");
  });
});

describe("splitUpcomingPast", () => {
  const rows = buildAdminBookingRows(
    [
      booking(),
      booking({
        id: "k0",
        checkIn: d("2026-10-01"),
        checkOut: d("2026-10-03"),
      }),
    ],
    [
      block(),
      block({
        id: "b-now",
        startDate: d("2026-10-30"),
        endDate: d("2026-11-01"),
      }),
      block({
        id: "b-old",
        startDate: d("2026-09-01"),
        endDate: d("2026-09-04"),
      }),
    ],
  );

  it("upcoming includes stays in progress, soonest first", () => {
    const { upcoming } = splitUpcomingPast(rows, "2026-10-31");
    expect(upcoming.map((r) => r.id)).toEqual(["b-now", "b1", "k1"]);
  });

  it("past is newest first", () => {
    const { past } = splitUpcomingPast(rows, "2026-10-31");
    expect(past.map((r) => r.id)).toEqual(["k0", "b-old"]);
  });
});

describe("parseBookingsView", () => {
  it("defaults to upcoming", () => {
    expect(parseBookingsView(undefined)).toBe("upcoming");
    expect(parseBookingsView("junk")).toBe("upcoming");
    expect(parseBookingsView("past")).toBe("past");
    expect(parseBookingsView(["past"])).toBe("past");
  });
});
