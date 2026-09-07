import { NextResponse } from "next/server";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { retrieveConnectStatus } from "@/lib/stripe-connect";

/**
 * Thin v2 Connect events. Configure a Dashboard destination:
 * Events from = Connected accounts, payload = Thin, types:
 *   v2.core.account[requirements].updated
 *   v2.core.account[configuration.merchant].capability_status_updated
 *   v2.core.account[configuration.customer].capability_status_updated
 *
 * Local:
 * stripe listen --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' --forward-thin-to localhost:3000/api/stripe/thin-webhook
 *
 * Onboarding status is re-fetched from the API (not stored).
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_THIN_WEBHOOK_SECRET?.trim();
  const sig = req.headers.get("stripe-signature");
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Missing STRIPE_THIN_WEBHOOK_SECRET. Create a thin event destination in Dashboard → Webhooks and paste the signing secret.",
      },
      { status: 400 },
    );
  }
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripeClient = getStripeClient() as ReturnType<typeof getStripeClient> & {
    parseThinEvent?: (
      payload: string,
      header: string,
      secret: string,
    ) => { id: string; type?: string };
  };
  const body = await req.text();

  let thinEvent: { id: string; type?: string };
  try {
    // SDK name: parseThinEvent (prompt) or parseEventNotification (stripe-node v22).
    const parse = stripeClient.parseThinEvent
      ? stripeClient.parseThinEvent.bind(stripeClient)
      : stripeClient.parseEventNotification.bind(stripeClient);
    thinEvent = parse(body, sig, secret) as { id: string; type?: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid thin event";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const event = await stripeClient.v2.core.events.retrieve(thinEvent.id);
  const type = String(event.type || thinEvent.type || "");

  const relatedId =
    (event as { related_object?: { id?: string } }).related_object?.id ||
    null;

  if (
    type.includes("requirements") ||
    type.includes("configuration.merchant") ||
    type.includes("configuration.customer")
  ) {
    if (relatedId) {
      const status = await retrieveConnectStatus(relatedId).catch(() => null);
      console.info("[stripe:thin]", type, relatedId, status);
    }
  } else if (type.includes("configuration.recipient")) {
    console.info("[stripe:thin] recipient capability", relatedId);
  } else {
    console.info("[stripe:thin] unhandled", type, relatedId);
  }

  return NextResponse.json({ received: true, type });
}
