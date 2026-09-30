/**
 * Yall Come Back platform billing — hosts paying *us*.
 *
 * Completely separate from Connect:
 * - This file: Customer (cus_…) + card on the platform Stripe account.
 * - stripe-connect.ts: connected account (acct_…) for guest stay money.
 */

import { prisma } from "@/lib/db";
import { PRODUCT_ORIGIN } from "@/lib/features";
import { planSlugForSitePresence } from "@/lib/hosting";
import {
  CARD_PROCESSING_LINE,
  getStripe,
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

function cardLabelFromPaymentMethod(pm: unknown): string | null {
  if (!pm || typeof pm !== "object") return null;
  const card =
    "card" in pm
      ? (pm as { card?: { brand?: string; last4?: string } }).card
      : undefined;
  if (!card?.last4) return null;
  const brand = (card.brand || "card").toUpperCase();
  return `${brand} •••• ${card.last4}`;
}

function paymentMethodId(pm: unknown): string | null {
  if (typeof pm === "string" && pm.startsWith("pm_")) return pm;
  if (pm && typeof pm === "object" && "id" in pm) {
    const id = (pm as { id?: string }).id;
    return id && id.startsWith("pm_") ? id : null;
  }
  return null;
}

/** e.g. "VISA •••• 4242" when a card is on the platform Customer. */
export async function describePlatformCard(
  customerId: string,
): Promise<string | null> {
  const stripeClient = requireStripeClient();
  const customer = await stripeClient.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });
  if (customer.deleted) return null;
  const fromDefault = cardLabelFromPaymentMethod(
    customer.invoice_settings?.default_payment_method,
  );
  if (fromDefault) return fromDefault;

  const listed = await stripeClient.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  return cardLabelFromPaymentMethod(listed.data[0] ?? null);
}

/**
 * Checkout attaches the card to the subscription, not always to
 * customer.invoice_settings.default_payment_method. Copy it over so
 * invoices and "card on file" agree.
 */
export async function ensureCustomerDefaultCard(
  customerId: string,
  subscriptionId?: string | null,
): Promise<string | null> {
  const stripeClient = requireStripeClient();
  const customer = await stripeClient.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });
  if (customer.deleted) return null;
  const existing = cardLabelFromPaymentMethod(
    customer.invoice_settings?.default_payment_method,
  );
  if (existing) return existing;

  let pmId: string | null = null;
  if (subscriptionId) {
    const sub = await stripeClient.subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method"],
    });
    pmId = paymentMethodId(sub.default_payment_method);
  }
  if (!pmId) {
    const listed = await stripeClient.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    pmId = listed.data[0]?.id ?? null;
  }
  if (!pmId) return null;
  await stripeClient.customers.update(customerId, {
    invoice_settings: { default_payment_method: pmId },
  });
  return describePlatformCard(customerId);
}

/**
 * Apply a completed hosting Checkout session on return (do not wait for webhook).
 */
export async function applyHostingCheckoutSession(opts: {
  sessionId: string;
  expectedHostId?: string | null;
}): Promise<{ ok: boolean; cardLabel: string | null }> {
  if (!opts.sessionId.startsWith("cs_")) {
    return { ok: false, cardLabel: null };
  }
  const stripeClient = requireStripeClient();
  const session = await stripeClient.checkout.sessions.retrieve(opts.sessionId, {
    expand: ["subscription.default_payment_method"],
  });
  if (session.metadata?.kind !== "hosting_subscription") {
    return { ok: false, cardLabel: null };
  }
  const hostId = session.metadata?.hostId || opts.expectedHostId || "";
  if (!hostId) {
    return { ok: false, cardLabel: null };
  }
  const customerId = stripeObjectId(session.customer);
  const subscriptionId = stripeObjectId(session.subscription);
  await applyHostingSubscriptionFromStripe({
    hostId,
    customerId,
    subscriptionId,
    stripeStatus:
      session.status === "complete" || session.payment_status === "paid"
        ? "active"
        : session.status,
  });
  const cardLabel = customerId
    ? await ensureCustomerDefaultCard(customerId, subscriptionId)
    : null;
  return { ok: true, cardLabel };
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
    success_url: `${origin}/account/settings/subscription?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account/settings/subscription?canceled=1`,
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
    return_url: `${origin}/account/settings/subscription`,
  });
}

/** Stripe `pause_collection` is set while Ops has moved the host to complimentary. */
export function stripeCollectionIsPaused(
  pauseCollection: unknown,
): boolean {
  return Boolean(pauseCollection && typeof pauseCollection === "object");
}

/**
 * Stop invoicing a platform hosting subscription without canceling it.
 * `void` means Stripe will not create invoices while paused.
 */
export async function pausePlatformHostingSubscription(
  subscriptionId: string | null | undefined,
): Promise<boolean> {
  if (!subscriptionId) return false;
  const stripe = getStripe();
  if (!stripe) return false;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    if (sub.status === "canceled" || sub.status === "incomplete_expired") {
      return false;
    }
    if (stripeCollectionIsPaused(sub.pause_collection)) return true;
    await stripe.subscriptions.update(subscriptionId, {
      pause_collection: { behavior: "void" },
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/no such subscription/i.test(message)) return false;
    throw err;
  }
}

/** Persist hosting subscription status from platform Billing webhooks. */
export async function applyHostingSubscriptionFromStripe(opts: {
  hostId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  stripeStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
  pauseCollection?: unknown;
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
  const paused = stripeCollectionIsPaused(opts.pauseCollection);
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

  const stripeSubscriptionStatus = paused
    ? "paused"
    : opts.stripeStatus || host.stripeSubscriptionStatus;

  const updated = await prisma.host.update({
    where: { id: host.id },
    data: {
      stripeCustomerId: opts.customerId || host.stripeCustomerId,
      stripeSubscriptionId: opts.subscriptionId || host.stripeSubscriptionId,
      stripeSubscriptionStatus,
      subscriptionStatus,
      ...(hostingPastDueAt !== undefined ? { hostingPastDueAt } : {}),
      ...(hostingDunningReminderSentAt !== undefined
        ? { hostingDunningReminderSentAt }
        : {}),
    },
  });
  if (subscriptionStatus === "ACTIVE" && !paused) {
    await promoteComplimentaryHostIfPaid(updated.id);
  }
  return updated;
}

/**
 * Complimentary is $0 forever — until they actually pay. A successful hosting
 * charge moves them onto the matching paid plan (website $25 flat, or
 * marketplace $5/listing) so Ops does not stay out of sync.
 */
export async function promoteComplimentaryHostIfPaid(hostId: string) {
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    include: { plan: true },
  });
  if (!host || host.hostingMode !== "PLATFORM") return host;
  if (host.plan && host.plan.monthlyPrice > 0) return host;
  if ((host.stripeSubscriptionStatus || "").toLowerCase() === "paused") {
    return host;
  }
  const slug = planSlugForSitePresence(host.sitePresence);
  const paid = await prisma.hostingPlan.findFirst({
    where: { slug, isActive: true, monthlyPrice: { gt: 0 } },
  });
  if (!paid) return host;
  return prisma.host.update({
    where: { id: host.id },
    data: { planId: paid.id },
    include: { plan: true },
  });
}

export { stripeObjectId };
