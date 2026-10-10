import { NextResponse } from "next/server";
import { recordPageView } from "@/lib/analytics";
import { incomingIpFromRequest, rateLimitAllow } from "@/lib/rate-limit";
import { isValidVisitorId, VISITOR_COOKIE } from "@/lib/analytics-visitor";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${VISITOR_COOKIE}=`));
  const vid = cookie?.slice(VISITOR_COOKIE.length + 1);
  const key = isValidVisitorId(vid)
    ? `analytics-pv:${vid}`
    : `analytics-pv:${incomingIpFromRequest(req)}`;
  if (!rateLimitAllow(key, 120, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { path?: string; referrer?: string | null; search?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  try {
    const result = await recordPageView({
      path: body.path || "",
      referrer: body.referrer,
      search: body.search,
      userAgent: req.headers.get("user-agent"),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, skipped: result.skipped ?? null });
  } catch (e) {
    console.error("[analytics] pageview", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
