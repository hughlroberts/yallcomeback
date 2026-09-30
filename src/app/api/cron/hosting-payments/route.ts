import { NextResponse } from "next/server";
import { runDailyHostingPaymentCheck } from "@/lib/hosting-payment-check";
import { cronUnauthorized } from "@/lib/cron-auth";

/**
 * Daily hosting payment check (force run).
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.yallcomeback.app/api/cron/hosting-payments
 */
export async function GET(req: Request) {
  const denied = cronUnauthorized(req);
  if (denied) return denied;

  const result = await runDailyHostingPaymentCheck();
  return NextResponse.json(result);
}
