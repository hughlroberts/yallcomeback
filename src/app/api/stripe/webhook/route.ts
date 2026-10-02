import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  markHostingInvoicePaidByStripeId,
  recordStripePlatformInvoice,
} from "@/lib/hosting-billing";
import { markBlockInvoicePaidByStripeId } from "@/lib/block-invoice";
import {
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
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as {
      metadata?: { kind?: string; hostId?: string };
      customer?: string | { id?: string } | null;
    };
    if (invoice.metadata?.kind === "hosting" && invoice.metadata.hostId) {
      await markHostingPastDue(invoice.metadata.hostId);
    } else if (invoice.metadata?.kind === "hosting_subscription" && invoice.metadata.hostId) {
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
      metadata?: { kind?: string; hostId?: string; bookingId?: string };
      mode?: string;
      payment_status?: string;
      subscription?: string | { id?: string } | null;
      customer?: string | { id?: string } | null;
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
        const existingBlock = await prisma.calendarBlock.findFirst({
          where: { bookingId: booking.id },
          select: { id: true },
        });
        let calendarOk = Boolean(existingBlock);
        if (!existingBlock) {
          const { isRangeAvailable, lockPropertyBookings } = await import(
            "@/lib/availability"
          );
          try {
            await prisma.$transaction(async (tx) => {
              await lockPropertyBookings(tx, booking.propertyId);
              const free = await isRangeAvailable(
                booking.propertyId,
                booking.checkIn,
                booking.checkOut,
                booking.id,
                tx,
              );
              if (!free) {
                throw new Error("Dates taken after checkout");
              }
              await tx.calendarBlock.create({
                data: {
                  propertyId: booking.propertyId,
                  bookingId: booking.id,
                  source: "BOOKING",
                  startDate: booking.checkIn,
                  endDate: booking.checkOut,
                  occupantName: booking.guestName,
                  paymentMethod: "STRIPE",
                  notes: `Booking ${booking.id} (CONFIRMED)`,
                },
              });
            });
            calendarOk = true;
          } catch (e) {
            console.error(
              "[stripe] booking calendar block failed",
              booking.id,
              e,
            );
          }
        }
        if (calendarOk) {
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
    }
    if (session.metadata?.kind === "hosting_subscription") {
      const customerId = stripeObjectId(session.customer);
      const subscriptionId = stripeObjectId(session.subscription);
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
        select: { id: true, status: true, sourceChannel: true },
      });
      if (booking && booking.status === "PENDING_PAYMENT") {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED" },
        });
        if (booking.sourceChannel !== "agent") {
          await prisma.calendarBlock.deleteMany({
            where: { bookingId: booking.id },
          });
        }
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
