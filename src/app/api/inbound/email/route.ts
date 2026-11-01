import { NextResponse } from "next/server";
import {
  inboundWebhookSecret,
  isInboundEmailEnabled,
} from "@/lib/inbound/reply-address";
import { verifySvixSignature } from "@/lib/inbound/svix";
import {
  fetchReceivedEmail,
  TransientInboundError,
} from "@/lib/inbound/resend-receiving";
import { handleInboundEmail } from "@/lib/inbound/handle";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Resend inbound webhook (event `email.received`). Replies to
 * reply+<token>@INBOUND_EMAIL_DOMAIN become messages in their thread.
 * Off (404) unless every inbound env var is set.
 */
export async function POST(req: Request) {
  if (!isInboundEmailEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Too large" }, { status: 413 });
  }
  const ok = verifySvixSignature({
    secret: inboundWebhookSecret()!,
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
    body: raw,
  });
  if (!ok) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  if (event.type !== "email.received" || !event.data?.email_id) {
    return NextResponse.json({ ok: true, ignored: "event" });
  }

  try {
    const email = await fetchReceivedEmail(event.data.email_id);
    if (!email) return NextResponse.json({ ok: true, ignored: "missing" });
    const r = await handleInboundEmail(email);
    return NextResponse.json(
      r.status === "added" ? { ok: true } : { ok: true, ignored: r.reason },
    );
  } catch (e) {
    // 5xx makes Resend retry; duplicates are dropped by inboundEmailId.
    console.error(
      "[inbound-email] failed",
      e instanceof TransientInboundError ? e.message : e,
    );
    return NextResponse.json({ error: "Try again" }, { status: 500 });
  }
}
