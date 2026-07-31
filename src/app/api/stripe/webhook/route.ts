import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { markHostingInvoicePaidByStripeId } from "@/lib/hosting-billing";
import { markBlockInvoicePaidByStripeId } from "@/lib/block-invoice";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_succeeded"
  ) {
    const invoice = event.data.object as {
      id?: string;
      metadata?: { kind?: string };
    };
    if (invoice.id) {
      // Guest stay invoices (calendar blocks) and hosting invoices
      if (invoice.metadata?.kind === "calendar_block") {
        await markBlockInvoicePaidByStripeId(invoice.id);
      } else {
        const hosting = await markHostingInvoicePaidByStripeId(invoice.id);
        if (!hosting) {
          await markBlockInvoicePaidByStripeId(invoice.id);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
