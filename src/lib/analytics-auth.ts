import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function stringsEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Fail closed: missing ANALYTICS_API_TOKEN → 503; bad bearer → 401. */
export function analyticsUnauthorized(req: Request): NextResponse | null {
  const secret = process.env.ANALYTICS_API_TOKEN?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Analytics API is not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!stringsEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
