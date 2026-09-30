import { NextResponse } from "next/server";
import { isPricingIntelligenceEnabled } from "@/lib/platform-features";
import { runMonthlyPricingIntelligence } from "@/lib/pricing-intelligence/run";
import { cronUnauthorized } from "@/lib/cron-auth";

/**
 * Monthly market pricing research (hosted platform only).
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.yallcomeback.app/api/cron/pricing-intelligence
 *
 * Prefer an external monthly scheduler.
 * In-process cron only runs this when PRICING_INTELLIGENCE_MONTHLY_IN_PROCESS=true
 * (see cron-jobs) — default is off so we do not re-run every 20 minutes.
 */
export async function GET(req: Request) {
  if (!isPricingIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "Pricing intelligence disabled (open-source / non-platform)" },
      { status: 404 },
    );
  }

  const denied = cronUnauthorized(req);
  if (denied) return denied;

  const result = await runMonthlyPricingIntelligence();
  return NextResponse.json(result);
}
