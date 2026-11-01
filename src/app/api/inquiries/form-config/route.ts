import { NextResponse } from "next/server";
import { issueFormStamp, turnstileSiteKey } from "@/lib/inquiries/human-checks";

export const dynamic = "force-dynamic";

/**
 * Fresh fill-time stamp (+ public Turnstile site key when configured) for the
 * "Message host" web form. The site key is public by design; the secret
 * never leaves the server.
 */
export async function GET() {
  return NextResponse.json(
    { stamp: issueFormStamp(), turnstileSiteKey: turnstileSiteKey() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
