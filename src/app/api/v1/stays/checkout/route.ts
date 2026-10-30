import { NextRequest, NextResponse } from "next/server";
import {
  agentApiDisabledResponse,
  agentCheckoutUnauthorized,
} from "@/lib/agent/guard";
import { createAgentStayCheckout } from "@/lib/agent/checkout";
import { incomingIpFromRequest, rateLimitAllow } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const CHECKOUT_IP_LIMIT = 10;
const CHECKOUT_IP_WINDOW_MS = 15 * 60 * 1000;
const CHECKOUT_EMAIL_LIMIT = 5;
const CHECKOUT_EMAIL_WINDOW_MS = 60 * 60 * 1000;

function withCors(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CORS)) {
    res.headers.set(key, value);
  }
  return res;
}

/**
 * Pay-first agent checkout. Card Checkout URL only.
 * Calendar is not written until Stripe says the deposit is paid.
 */
export async function POST(req: NextRequest) {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;

  const denied = agentCheckoutUnauthorized(req);
  if (denied) return withCors(denied);

  const ip = incomingIpFromRequest(req);
  if (
    !rateLimitAllow(
      `agent-checkout:ip:${ip}`,
      CHECKOUT_IP_LIMIT,
      CHECKOUT_IP_WINDOW_MS,
    )
  ) {
    return withCors(
      NextResponse.json(
        { ok: false, error: "Too many checkout attempts. Try again later." },
        { status: 429 },
      ),
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON body required" },
      { status: 400, headers: CORS },
    );
  }

  const guestEmail = String(body.guestEmail || "")
    .trim()
    .toLowerCase();
  if (
    guestEmail &&
    !rateLimitAllow(
      `agent-checkout:email:${guestEmail}`,
      CHECKOUT_EMAIL_LIMIT,
      CHECKOUT_EMAIL_WINDOW_MS,
    )
  ) {
    return withCors(
      NextResponse.json(
        { ok: false, error: "Too many checkout attempts. Try again later." },
        { status: 429 },
      ),
    );
  }

  try {
    const result = await createAgentStayCheckout({
      slug: String(body.slug || ""),
      checkIn: String(body.checkIn || ""),
      checkOut: String(body.checkOut || ""),
      guests: body.guests != null ? Number(body.guests) : undefined,
      pets: body.pets != null ? Number(body.pets) : undefined,
      guestName: String(body.guestName || ""),
      guestEmail: String(body.guestEmail || ""),
      guestPhone:
        body.guestPhone != null ? String(body.guestPhone) : undefined,
      acceptTerms: body.acceptTerms === true,
      paid: body.paid,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status, headers: CORS },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        version: "v1",
        checkoutUrl: result.checkoutUrl,
        expiresAt: result.expiresAt,
        bookingId: result.bookingId,
        quote: result.quote,
      },
      { headers: CORS },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    const status = message === "Dates not available" ? 409 : 500;
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: CORS },
    );
  }
}

export async function OPTIONS() {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;
  return new NextResponse(null, { status: 204, headers: CORS });
}
