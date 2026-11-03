import { NextRequest, NextResponse } from "next/server";
import {
  applyChannelOptOut,
  verifyUnsubscribeToken,
} from "@/lib/notification-prefs";

export const dynamic = "force-dynamic";

/**
 * RFC 8058 one-click unsubscribe (List-Unsubscribe-Post). Mail apps POST
 * `List-Unsubscribe=One-Click` with the signed token in the URL. No cookies,
 * no redirect. GET does nothing here, so link scanners cannot unsubscribe.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() || "";
  const verified = token ? verifyUnsubscribeToken(token) : null;
  if (!verified?.ok) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await applyChannelOptOut({
    channel: verified.channel,
    address: verified.address,
    source: "one_click",
  });
  return NextResponse.json({ ok: true });
}
