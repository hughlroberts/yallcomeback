import { NextRequest, NextResponse } from "next/server";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import {
  incomingIpFromRequest,
  rateLimitedPayload,
} from "@/lib/rate-limit";
import {
  parseTrip,
  submitInquiry,
  tripContextLine,
} from "@/lib/inquiries/submit";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Retry-After",
};

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...CORS, ...headers } });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Pre-booking question to a host, sent by an AI agent for a real person.
 * No token. Same content filter, rate limits, and dedupe as the listing page
 * form; the host replies by email to guestEmail and in their admin inbox.
 */
export async function POST(req: NextRequest) {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "JSON body required" }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ ok: false, error: "JSON body required" }, 400);
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const message = typeof body.message === "string" ? body.message : "";
  if (!slug) return json({ ok: false, error: "slug is required" }, 400);

  const context = tripContextLine(body);
  const result = await submitInquiry(
    {
      propertySlug: slug,
      guestName: typeof body.guestName === "string" ? body.guestName : "",
      guestEmail: typeof body.guestEmail === "string" ? body.guestEmail : "",
      guestPhone: typeof body.guestPhone === "string" ? body.guestPhone : null,
      subject: typeof body.subject === "string" ? body.subject : null,
      body: context && message.trim() ? `${context}\n\n${message}` : message,
      trip: parseTrip(body),
    },
    {
      source: "AGENT",
      ip: incomingIpFromRequest(req),
      agentName: typeof body.agentName === "string" ? body.agentName : null,
    },
  );

  if (!result.ok && result.status === 429) {
    const p = rateLimitedPayload(result);
    return json(p.body, 429, p.headers);
  }
  if (!result.ok) {
    return json(
      { ok: false, error: result.error, code: result.code },
      result.status,
    );
  }
  return json(
    {
      ok: true,
      inquiryId: result.conversationId,
      duplicate: result.duplicate,
      hostNotification: result.hostNotification,
      guestConfirmation: result.guestConfirmation,
      message: result.duplicate
        ? "The host already has this question from this email; it was not sent again."
        : "Sent. The host replies by email to guestEmail.",
    },
    result.duplicate ? 200 : 201,
  );
}
