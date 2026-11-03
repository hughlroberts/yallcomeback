import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  markHostingInvoicePaidByStripeId,
  recordStripePlatformInvoice,
} from "@/lib/hosting-billing";
import { markBlockInvoicePaidByStripeId } from "@/lib/block-invoice";
import { isBrandedUpgradeMetadata } from "@/lib/branded-upgrade";
import {
  applyBrandedUpgrade,
  applyHostingSubscriptionFromStripe,
  ensureCustomerDefaultCard,
  stripeObjectId,
} from "@/lib/platform-billing";
import { markHostingPastDue } from "@/lib/hosting-dunning";
import { prisma } from "@/lib/db";

/**
 * Snapshot webhooks (not thin). Checkout, invoices, and Billing subscriptions.
 * Connect v2 requirement changes use /api/stripe/thin-webhook instead.
 */
export async function POST(req: Request) {
  const stripeClient = getStripe();
  if (!stripeClient) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 },
    );
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  // Platform endpoint secret, plus an optional second secret when the
  // "Connected accounts" endpoint is a separate destination in Stripe.
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET?.trim(),
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim(),
  ].filter((v): v is string => Boolean(v));

  if (!sig || secrets.length === 0) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  let event: ReturnType<typeof stripeClient.webhooks.constructEvent> | null =
    null;
  for (const secret of secrets) {
    try {
      event = stripeClient.webhooks.constructEvent(body, sig, secret);
      break;
    } catch {
      /* try the next secret */
    }
  }
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as {
      metadata?: { kind?: string; hostId?: string };
      customer?: string | { id?: string } | null;
    };
    if (invoice.metadata?.kind === "hosting" && invoice.metadata.hostId) {
      await markHostingPastDue(invoice.metadata.hostId);
    } else if (
      invoice.metadata?.kind === "hosting_subscription" &&
      invoice.metadata.hostId
    ) {
      await markHostingPastDue(invoice.metadata.hostId);
    }
  }

  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_succeeded"
  ) {
    const invoice = event.data.object as {
      id?: string;
      metadata?: { kind?: string; hostId?: string };
    };
    if (invoice.id) {
      if (invoice.metadata?.kind === "calendar_block") {
        await markBlockInvoicePaidByStripeId(invoice.id);
      } else {
        const hosting = await markHostingInvoicePaidByStripeId(invoice.id);
        if (!hosting) {
          const recorded = await recordStripePlatformInvoice(invoice);
          if (!recorded) {
            await markBlockInvoicePaidByStripeId(invoice.id);
          }
        }
      }
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      metadata?: {
        kind?: string;
        hostId?: string;
        bookingId?: string;
        upgrade?: string;
      };
      mode?: string;
      payment_status?: string;
      subscription?: string | { id?: string } | null;
      customer?: string | { id?: string } | null;
    };
    if (
      session.metadata?.kind === "pricing_intelligence_addon" &&
      session.metadata.hostId
    ) {
      const { PRICING_INTELLIGENCE_ADDON_USD } =
        await import("@/lib/platform-features");
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
    if (session.metadata?.kind === "booking_deposit") {
      // Direct Charges live on the host's connected account (event.account).
      const { settleBookingDepositSession } =
        await import("@/lib/booking-deposit-webhook");
      try {
        const outcome = await settleBookingDepositSession(
          event.data.object as Parameters<
            typeof settleBookingDepositSession
          >[0],
          (event as { account?: string | null }).account ?? null,
        );
        // Paid → guest "booking confirmed" + host "new booking" emails.
        // Dates lost the race → refunded + cancelled → cancellation emails.
        // Both claim-once and never throw.
        const bookingId = session.metadata.bookingId;
        if (bookingId && outcome === "confirmed") {
          const { sendBookingCreatedEmails } =
            await import("@/lib/booking-emails");
          await sendBookingCreatedEmails(bookingId);
        } else if (bookingId && outcome === "refunded") {
          const { sendCancellationEmails } =
            await import("@/lib/booking-emails");
          await sendCancellationEmails(bookingId, "SYSTEM");
        }
      } catch (e) {
        console.error(
          "[stripe] booking deposit settle failed",
          session.metadata.bookingId,
          e,
        );
        // 500 → Stripe retries; settle + refund are idempotent.
        return NextResponse.json(
          { error: "Booking deposit not settled" },
          { status: 500 },
        );
      }
    }
    if (session.metadata?.kind === "hosting_subscription") {
      const customerId = stripeObjectId(session.customer);
      const subscriptionId = stripeObjectId(session.subscription);
      // Marketplace → Branded: switch the plan only now that checkout is paid.
      if (
        session.metadata.hostId &&
        isBrandedUpgradeMetadata(session.metadata)
      ) {
        await applyBrandedUpgrade(session.metadata.hostId);
      }
      await applyHostingSubscriptionFromStripe({
        hostId: session.metadata.hostId,
        customerId,
        subscriptionId,
        stripeStatus: "active",
      });
      if (customerId) {
        await ensureCustomerDefaultCard(customerId, subscriptionId).catch(
          () => null,
        );
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const expired = event.data.object as {
      metadata?: { kind?: string; bookingId?: string; source?: string };
    };
    if (
      expired.metadata?.kind === "booking_deposit" &&
      expired.metadata.bookingId
    ) {
      const booking = await prisma.booking.findUnique({
        where: { id: expired.metadata.bookingId },
        select: {
          id: true,
          status: true,
          sourceChannel: true,
          propertyId: true,
          totalAmount: true,
        },
      });
      if (booking && booking.status === "PENDING_PAYMENT") {
        // Abandoned card checkout: no booking email was ever sent for it
        // (those go out on payment), so no cancellation email either.
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelledBy: "SYSTEM",
            cancelReason: "Card checkout expired before payment.",
          },
        });
        if (booking.sourceChannel !== "agent") {
          await prisma.calendarBlock.deleteMany({
            where: { bookingId: booking.id },
          });
        }
        const { trackAnalyticsEvent } = await import("@/lib/analytics");
        trackAnalyticsEvent({
          name: "booking_cancelled",
          listingId: booking.propertyId,
          bookingId: booking.id,
          value: booking.totalAmount,
        });
      }
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
        customer?: string | { id?: string } | null;
        metadata?: { kind?: string; hostId?: string };
        items?: { data?: { price?: { id?: string }; quantity?: number }[] };
        pause_collection?: unknown;
      };
      if (sub.metadata?.kind === "hosting_subscription") {
        await applyHostingSubscriptionFromStripe({
          hostId: sub.metadata.hostId,
          customerId: stripeObjectId(sub.customer),
          subscriptionId: sub.id,
          stripeStatus: sub.status,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          pauseCollection: sub.pause_collection,
        });
      }
      if (
        sub.metadata?.kind === "pricing_intelligence_addon" &&
        sub.metadata.hostId
      ) {
        const status = sub.status;
        if (
          status === "canceled" ||
          status === "unpaid" ||
          event.type === "customer.subscription.deleted"
        ) {
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
