import { NextRequest, NextResponse } from "next/server";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import { createAgentStayCheckout } from "@/lib/agent/checkout";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Pay-first agent checkout. Card Checkout URL only.
 * Calendar is not written until Stripe says the deposit is paid.
 */
export async function POST(req: NextRequest) {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON body required" },
      { status: 400, headers: CORS },
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
