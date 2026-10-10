import { NextResponse } from "next/server";
import { analyticsUnauthorized } from "@/lib/analytics-auth";
import { buildAnalyticsStats } from "@/lib/analytics-stats";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Bearer ANALYTICS_API_TOKEN. First-party counts only; no IPs.
 */
export async function GET(req: Request) {
  const denied = analyticsUnauthorized(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const result = await buildAnalyticsStats(
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
