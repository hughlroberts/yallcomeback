import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { isAgentApiEnabled } from "@/lib/platform-features";

/** 404 with no body or CORS when the agent API is off (MIT self-host). */
export function agentApiDisabledResponse(): NextResponse | null {
  if (isAgentApiEnabled()) return null;
  return new NextResponse(null, { status: 404 });
}

function bearerMatches(presented: string, secret: string): boolean {
  const bufA = Buffer.from(presented);
  const bufB = Buffer.from(secret);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Checkout creates Stripe sessions. Fail closed when the hosted agent API
 * is on and AGENT_API_TOKEN is missing or wrong. Read endpoints stay public.
 */
export function agentCheckoutUnauthorized(req: Request): NextResponse | null {
  const secret = process.env.AGENT_API_TOKEN?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Checkout is not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!bearerMatches(auth, `Bearer ${secret}`)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  return null;
}
