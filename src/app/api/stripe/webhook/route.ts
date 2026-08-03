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

  // Pricing intelligence $35/mo add-on (Checkout subscription)
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      metadata?: { kind?: string; hostId?: string };
      mode?: string;
    };
    if (
      session.metadata?.kind === "pricing_intelligence_addon" &&
      session.metadata.hostId
    ) {
      const { prisma } = await import("@/lib/db");
      const {
        PRICING_INTELLIGENCE_ADDON_USD,
      } = await import("@/lib/platform-features");
      await prisma.host.update({
        where: { id: session.metadata.hostId },
        data: {
          pricingIntelligenceAddonStatus: "ACTIVE",
          pricingIntelligenceAddonAmount: PRICING_INTELLIGENCE_ADDON_USD,
          pricingIntelligenceAddonStartedAt: new Date(),
          pricingIntelligenceAddonNotes: `Activated via Stripe Checkout ${new Date().toISOString().slice(0, 10)}`,
        },
      });
    }
  }

  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as {
      status?: string;
      metadata?: { kind?: string; hostId?: string };
    };
    if (
      sub.metadata?.kind === "pricing_intelligence_addon" &&
      sub.metadata.hostId
    ) {
      const { prisma } = await import("@/lib/db");
      const status = sub.status;
      if (status === "canceled" || status === "unpaid" || event.type === "customer.subscription.deleted") {
        await prisma.host.update({
          where: { id: sub.metadata.hostId },
          data: {
            pricingIntelligenceAddonStatus:
              status === "unpaid" ? "PAST_DUE" : "CANCELLED",
            pricingIntelligenceAddonNotes: `Stripe subscription ${status || "ended"} ${new Date().toISOString().slice(0, 10)}`,
          },
        });
      } else if (status === "active" || status === "trialing") {
        await prisma.host.update({
          where: { id: sub.metadata.hostId },
          data: {
            pricingIntelligenceAddonStatus: "ACTIVE",
          },
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
