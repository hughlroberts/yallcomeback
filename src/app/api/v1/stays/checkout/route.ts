import { NextRequest, NextResponse } from "next/server";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import { createAgentStayCheckout } from "@/lib/agent/checkout";
import { agentCheckoutBookPath } from "@/lib/agent/book-path";
import { absoluteUrl, publicOrigin } from "@/lib/agent/origin";
import {
  incomingIpFromRequest,
  rateLimitedPayload,
  rateLimitHit,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Retry-After",
};

// Public endpoint (no token). Per-IP limits stop anonymous callers from
// flooding Stripe with Checkout Sessions; Railway sets X-Real-IP at the edge.
const CHECKOUT_IP_LIMIT = 10;
const CHECKOUT_IP_WINDOW_MS = 15 * 60 * 1000;
const CHECKOUT_IP_DAILY_LIMIT = 40;
const CHECKOUT_IP_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const CHECKOUT_EMAIL_LIMIT = 5;
const CHECKOUT_EMAIL_WINDOW_MS = 60 * 60 * 1000;

function withCors(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CORS)) {
    res.headers.set(key, value);
  }
  return res;
}

/**
 * Public pay-first agent checkout (no token). Card Checkout URL only.
 * Nothing is held: the calendar is written only when Stripe says the deposit
 * is paid, and the webhook refunds a payment that lost the dates to another.
 */
function checkoutTooMany(
  rule: { name: string; max: number; windowMs: number },
  retryAfterSeconds: number,
) {
  const p = rateLimitedPayload({
    error: "Too many checkout attempts. Try again later.",
    code: "rate_limited",
    limit: {
      name: rule.name,
      max: rule.max,
      windowSeconds: rule.windowMs / 1000,
    },
    retryAfterSeconds,
  });
  return withCors(NextResponse.json(p.body, { status: 429, headers: p.headers }));
}

export async function POST(req: NextRequest) {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;

  const ip = incomingIpFromRequest(req);
  const ipRules = [
    {
      key: `agent-checkout:ip:${ip}`,
      name: "ip_per_15_minutes",
      max: CHECKOUT_IP_LIMIT,
      windowMs: CHECKOUT_IP_WINDOW_MS,
    },
    {
      key: `agent-checkout:ip-day:${ip}`,
      name: "ip_per_day",
      max: CHECKOUT_IP_DAILY_LIMIT,
      windowMs: CHECKOUT_IP_DAILY_WINDOW_MS,
    },
  ];
  for (const rule of ipRules) {
    const check = rateLimitHit(rule.key, rule.max, rule.windowMs);
    if (!check.allowed) return checkoutTooMany(rule, check.retryAfterSeconds);
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
  if (guestEmail) {
    const rule = {
      name: "email_per_hour",
      max: CHECKOUT_EMAIL_LIMIT,
      windowMs: CHECKOUT_EMAIL_WINDOW_MS,
    };
    const check = rateLimitHit(
      `agent-checkout:email:${guestEmail}`,
      rule.max,
      rule.windowMs,
    );
    if (!check.allowed) return checkoutTooMany(rule, check.retryAfterSeconds);
  }

  // A 409 tells the agent to send the guest to bookUrl, so include it.
  // Keep the request's dates and party so the page restores the selection.
  const bookPath = agentCheckoutBookPath(String(body.slug || ""), {
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    guests: body.guests,
    pets: body.pets,
  });
  const conflictExtras = (status: number) =>
    status === 409 && bookPath
      ? { bookUrl: absoluteUrl(publicOrigin(req), bookPath) }
      : {};

  try {
    const result = await createAgentStayCheckout({
      slug: String(body.slug || ""),
      checkIn: String(body.checkIn || ""),
      checkOut: String(body.checkOut || ""),
      guests: body.guests != null ? Number(body.guests) : undefined,
      pets: body.pets != null ? Number(body.pets) : undefined,
      guestName: String(body.guestName || ""),
      guestEmail: String(body.guestEmail || ""),
      guestPhone: body.guestPhone != null ? String(body.guestPhone) : undefined,
      acceptTerms: body.acceptTerms === true,
      paid: body.paid,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          ...(result.code ? { code: result.code } : {}),
          ...conflictExtras(result.status),
        },
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
      { ok: false, error: message, ...conflictExtras(status) },
      { status, headers: CORS },
    );
  }
}

export async function OPTIONS() {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;
  return new NextResponse(null, { status: 204, headers: CORS });
}
