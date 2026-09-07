/**
 * Yall Come Back platform billing — hosts paying *us*.
 *
 * Completely separate from Connect:
 * - This file: Customer (cus_…) + card on the platform Stripe account.
 * - stripe-connect.ts: connected account (acct_…) for guest stay money.
 */

import { prisma } from "@/lib/db";
import { PRODUCT_ORIGIN } from "@/lib/features";
import {
  CARD_PROCESSING_LINE,
  hostingPriceId,
  processingFeeToNetCents,
  requireStripeClient,
} from "@/lib/stripe";

export type PlatformHost = {
  id: string;
  name: string;
  slug: string;
  stripeCustomerId: string | null;
  contactEmail: string | null;
  billingEmail: string | null;
  users?: { email: string | null }[];
};

function publicOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    PRODUCT_ORIGIN
  );
}

function hostBillingEmail(host: PlatformHost): string | null {
  return (
    host.billingEmail?.trim() ||
    host.contactEmail?.trim() ||
    host.users?.[0]?.email?.trim() ||
    null
  );
}

function stripeObjectId(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

/** Create or reuse the platform Customer for this host (not a Connect acct_). */
export async function ensurePlatformCustomer(
  host: PlatformHost,
): Promise<string> {
  if (host.stripeCustomerId) return host.stripeCustomerId;
  const email = hostBillingEmail(host);
  if (!email) {
    throw new Error(
      "Add a billing or contact email on this brand before you subscribe.",
    );
  }
  const stripeClient = requireStripeClient();
  const customer = await stripeClient.customers.create({
    email,
    name: host.name,
    metadata: {
      hostId: host.id,
      hostSlug: host.slug,
      kind: "platform_hosting",
    },
  });
  await prisma.host.update({
    where: { id: host.id },
    data: { stripeCustomerId: customer.id, billingEmail: email },
  });
  return customer.id;
}

export async function customerHasCardOnFile(
  customerId: string,
): Promise<boolean> {
  return Boolean(await describePlatformCard(customerId));
}

/** e.g. "VISA •••• 4242" when a default card is on the platform Customer. */
export async function describePlatformCard(
  customerId: string,
): Promise<string | null> {
  const stripeClient = requireStripeClient();
  const customer = await stripeClient.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });
  if (customer.deleted) return null;
  const pm = customer.invoice_settings?.default_payment_method;
  if (pm && typeof pm === "object" && "card" in pm) {
    const card = pm.card as { brand?: string; last4?: string } | undefined;
    if (card?.last4) {
      const brand = (card.brand || "card").toUpperCase();
      return `${brand} •••• ${card.last4}`;
    }
  }
  return null;
}

/**
 * Checkout on the platform account: host puts a card on file and starts
 * the monthly hosting subscription. Guest payouts never touch this Customer.
 */
export async function createHostingSubscriptionCheckout(host: PlatformHost) {
  const stripeClient = requireStripeClient();
  const price = hostingPriceId();
  if (!price) {
    throw new Error(
      "Missing STRIPE_HOSTING_PRICE_ID. Create a recurring Price on the platform Stripe account and set the id (price_...) in env.",
    );
  }
  const customerId = await ensurePlatformCustomer(host);
  const priceObj = await stripeClient.prices.retrieve(price);
  const netCents = priceObj.unit_amount;
  if (netCents == null || netCents <= 0) {
    throw new Error("Hosting Price must be a fixed recurring amount.");
  }
  const processingCents = processingFeeToNetCents(netCents);
  const origin = publicOrigin();
  const line_items: {
    price?: string;
    quantity: number;
    price_data?: {
      currency: string;
      unit_amount: number;
      recurring: { interval: "month" };
      product_data: { name: string };
    };
  }[] = [{ price, quantity: 1 }];
  if (processingCents > 0) {
    line_items.push({
      quantity: 1,
      price_data: {
        currency: (priceObj.currency || "usd").toLowerCase(),
        unit_amount: processingCents,
        recurring: { interval: "month" },
        product_data: { name: CARD_PROCESSING_LINE },
      },
    });
  }
  return stripeClient.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    payment_method_collection: "always",
    billing_address_collection: "auto",
    line_items,
    success_url: `${origin}/admin/payments?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/admin/payments?canceled=1`,
    metadata: { kind: "hosting_subscription", hostId: host.id },
    subscription_data: {
      metadata: { kind: "hosting_subscription", hostId: host.id },
    },
  });
}

export async function createPlatformBillingPortalSession(customerId: string) {
  const stripeClient = requireStripeClient();
  const origin = publicOrigin();
  return stripeClient.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/admin/payments`,
  });
}

/** Persist hosting subscription status from platform Billing webhooks. */
export async function applyHostingSubscriptionFromStripe(opts: {
  hostId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  stripeStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
}) {
  let host = opts.hostId
    ? await prisma.host.findUnique({ where: { id: opts.hostId } })
    : null;
  if (!host && opts.customerId) {
    host = await prisma.host.findFirst({
      where: { stripeCustomerId: opts.customerId },
    });
  }
  if (!host) return null;

  const raw = (opts.stripeStatus || "").toLowerCase();
  let subscriptionStatus:
    | "NONE"
    | "PENDING_PAYMENT"
    | "ACTIVE"
    | "PAST_DUE"
    | "PAUSED"
    | "CANCELLED" = host.subscriptionStatus;
  let hostingPastDueAt: Date | null | undefined;
  let hostingDunningReminderSentAt: Date | null | undefined;
  if (raw === "active" || raw === "trialing") {
    subscriptionStatus = "ACTIVE";
    hostingPastDueAt = null;
    hostingDunningReminderSentAt = null;
  } else if (raw === "past_due" || raw === "unpaid") {
    if (host.subscriptionStatus !== "PAUSED") {
      subscriptionStatus = "PAST_DUE";
    }
    hostingPastDueAt = host.hostingPastDueAt ?? new Date();
  } else if (raw === "canceled" || raw === "incomplete_expired")
    subscriptionStatus = "CANCELLED";
  else if (opts.cancelAtPeriodEnd) subscriptionStatus = "CANCELLED";

  return prisma.host.update({
    where: { id: host.id },
    data: {
      stripeCustomerId: opts.customerId || host.stripeCustomerId,
      stripeSubscriptionId: opts.subscriptionId || host.stripeSubscriptionId,
      stripeSubscriptionStatus:
        opts.stripeStatus || host.stripeSubscriptionStatus,
      subscriptionStatus,
      ...(hostingPastDueAt !== undefined ? { hostingPastDueAt } : {}),
      ...(hostingDunningReminderSentAt !== undefined
        ? { hostingDunningReminderSentAt }
        : {}),
    },
  });
}

export { stripeObjectId };
