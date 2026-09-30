import { NextResponse } from "next/server";
import { runIcalSync } from "@/lib/cron-jobs";
import { cronUnauthorized } from "@/lib/cron-auth";

/**
 * External cron entry (optional if in-process scheduler is on).
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.yallcomeback.app/api/cron/sync-ical
 */
export async function GET(req: Request) {
  const denied = cronUnauthorized(req);
  if (denied) return denied;

  const result = await runIcalSync();
  return NextResponse.json(result);
}
