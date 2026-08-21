import { NextResponse } from "next/server";
import { isPricingIntelligenceEnabled } from "@/lib/platform-features";
import { runMonthlyPricingIntelligence } from "@/lib/pricing-intelligence/run";

/**
 * Monthly market pricing research (hosted platform only).
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://yallcomeback.com/api/cron/pricing-intelligence
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

  const result = await runMonthlyPricingIntelligence();
  return NextResponse.json(result);
}
