import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { markHostingInvoicePaidByStripeId } from "@/lib/hosting-billing";
import { markBlockInvoicePaidByStripeId } from "@/lib/block-invoice";
import { applySubscriptionStatusFromStripe } from "@/lib/stripe-connect";
import { prisma } from "@/lib/db";

/**
 * Snapshot webhooks (not thin). Checkout, invoices, and Billing subscriptions.
 * Connect v2 requirement changes use /api/stripe/thin-webhook instead.
 */
export async function POST(req: Request) {
  const stripeClient = getStripe();
  if (!stripeClient) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json(
      {
        error:
          "Missing STRIPE_WEBHOOK_SECRET. Add a snapshot webhook in Dashboard → Webhooks pointing at /api/stripe/webhook.",
      },
      { status: 400 },
    );
  }

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(body, sig, secret);
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      metadata?: { kind?: string; hostId?: string; bookingId?: string };
      mode?: string;
      payment_status?: string;
      subscription?: string | { id?: string } | null;
      customer_account?: string | null;
    };
    if (
      session.metadata?.kind === "pricing_intelligence_addon" &&
      session.metadata.hostId
    ) {
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
    if (
      session.metadata?.kind === "booking_deposit" &&
      session.metadata.bookingId &&
      session.payment_status === "paid"
    ) {
      const booking = await prisma.booking.findUnique({
        where: { id: session.metadata.bookingId },
        include: { payments: true },
      });
      if (booking && booking.status === "PENDING_PAYMENT") {
        const pending = booking.payments.find((p) => p.status === "PENDING");
        if (pending) {
          await prisma.payment.update({
            where: { id: pending.id },
            data: { status: "PAID", paidAt: new Date() },
          });
        }
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "CONFIRMED" },
        });
      }
    }
    if (session.mode === "subscription" || session.metadata?.kind === "hosting_subscription") {
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      await applySubscriptionStatusFromStripe({
        customerAccountId: session.customer_account,
        subscriptionId: subId,
        stripeStatus: "active",
      });
    }
  }

  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created" ||
    event.type === "invoice.paid"
  ) {
    if (
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created"
    ) {
      const sub = event.data.object as {
        id?: string;
        status?: string;
        cancel_at_period_end?: boolean;
        customer_account?: string | null;
        metadata?: { kind?: string; hostId?: string };
        items?: { data?: { price?: { id?: string }; quantity?: number }[] };
        pause_collection?: unknown;
      };
      // V2 connected accounts: identity is customer_account (acct_...), not customer.
      await applySubscriptionStatusFromStripe({
        customerAccountId: sub.customer_account,
        subscriptionId: sub.id,
        stripeStatus: sub.status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      });
      if (
        sub.metadata?.kind === "pricing_intelligence_addon" &&
        sub.metadata.hostId
      ) {
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
  }

  if (
    event.type === "payment_method.attached" ||
    event.type === "payment_method.detached" ||
    event.type === "customer.updated" ||
    event.type === "customer.tax_id.created" ||
    event.type === "customer.tax_id.deleted" ||
    event.type === "customer.tax_id.updated" ||
    event.type === "billing_portal.configuration.created" ||
    event.type === "billing_portal.configuration.updated" ||
    event.type === "billing_portal.session.created"
  ) {
    console.info("[stripe:webhook]", event.type);
  }

  return NextResponse.json({ received: true });
}
