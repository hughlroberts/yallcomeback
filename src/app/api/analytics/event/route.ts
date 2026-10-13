import { NextResponse } from "next/server";
import { recordSignupStartedOnce } from "@/lib/analytics";
import { incomingIpFromRequest, rateLimitAllow } from "@/lib/rate-limit";
import {
  VISITOR_COOKIE,
  isSignupStartedName,
  isValidVisitorId,
} from "@/lib/analytics-visitor";

export const dynamic = "force-dynamic";

/** Client-allowed funnel starts only. Completions are recorded server-side. */
export async function POST(req: Request) {
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${VISITOR_COOKIE}=`));
  const vid = cookie?.slice(VISITOR_COOKIE.length + 1);
  const key = isValidVisitorId(vid)
    ? `analytics-ev:${vid}`
    : `analytics-ev:${incomingIpFromRequest(req)}`;
  if (!rateLimitAllow(key, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { name?: string; path?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  if (!body.name || !isSignupStartedName(body.name)) {
    return NextResponse.json({ error: "unsupported_event" }, { status: 400 });
  }

  const fallbackPath =
    body.name === "guest_signup_started" ? "/register" : "/for-hosts";

  try {
    await recordSignupStartedOnce(body.name, body.path || fallbackPath);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[analytics] event", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
