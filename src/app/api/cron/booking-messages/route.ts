import { NextResponse } from "next/server";
import { runBookingMessages } from "@/lib/cron-jobs";

/**
 * External cron entry (optional if in-process scheduler is on).
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.yallcomeback.app/api/cron/booking-messages
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

  const result = await runBookingMessages();
  return NextResponse.json(result);
}
