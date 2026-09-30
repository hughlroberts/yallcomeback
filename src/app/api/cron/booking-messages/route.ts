import { NextResponse } from "next/server";
import { runBookingMessages } from "@/lib/cron-jobs";
import { cronUnauthorized } from "@/lib/cron-auth";

/**
 * External cron entry (optional if in-process scheduler is on).
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.yallcomeback.app/api/cron/booking-messages
 */
export async function GET(req: Request) {
  const denied = cronUnauthorized(req);
  if (denied) return denied;

  const result = await runBookingMessages();
  return NextResponse.json(result);
}
