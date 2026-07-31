import { NextResponse } from "next/server";
import { processScheduledBookingMessages } from "@/lib/booking-messages";

/**
 * Deliver week-before and day-before booking messages into guest inboxes.
 * Call every 15–30 minutes:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/booking-messages
 *
 * Fail closed: CRON_SECRET must be set and Authorization must match.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Cron is not configured (CRON_SECRET missing)" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await processScheduledBookingMessages();
  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    results,
  });
}
