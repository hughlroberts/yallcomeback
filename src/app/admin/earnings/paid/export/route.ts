import { NextRequest, NextResponse } from "next/server";
import { requireHostAdmin } from "@/lib/auth";
import { getPaidEarnings } from "@/lib/earnings";

function csvEscape(v: string | number) {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const access = await requireHostAdmin();
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const rows = await getPaidEarnings(access, {
    year: sp.get("year") || undefined,
    propertyId: sp.get("listing") || undefined,
    q: sp.get("q") || undefined,
    method: sp.get("method") || undefined,
  });

  const header = [
    "Status",
    "Date",
    "Amount USD",
    "Payout method",
    "Listing",
    "Guest",
    "Booking ID",
    "Check-in",
    "Check-out",
    "Nights",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.status,
        r.date.toISOString().slice(0, 10),
        r.amount.toFixed(2),
        r.methodLabel,
        r.propertyTitle,
        r.guestName,
        r.bookingId,
        r.checkIn.toISOString().slice(0, 10),
        r.checkOut.toISOString().slice(0, 10),
        r.nights,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];

  const body = lines.join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="yallcomeback-paid-earnings.csv"`,
    },
  });
}
