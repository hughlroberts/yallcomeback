/**
 * Stripe Connect (Accounts v2) for hosts.
 *
 * - Each host maps to one v2 connected account (Host.stripeAccountId).
 * - Onboarding status is always read from the Stripe API (not cached in DB).
 * - Guest card deposits are Direct Charges on the connected account.
 * - Platform hosting is a subscription billed to the connected account
 *   (customer_account = acct_..., not a v1 customer id).
 */

import { prisma } from "@/lib/db";
import { PRODUCT_NAME, PRODUCT_ORIGIN } from "@/lib/features";
import {
  applicationFeeCents,
  CARD_PROCESSING_LINE,
  hostingPriceId,
  processingFeeToNetCents,
  requireStripeClient,
  toStripeAmount,
} from "@/lib/stripe";

export type ConnectOnboardingStatus = {
  accountId: string;
  displayName: string | null;
  readyToProcessPayments: boolean;
  onboardingComplete: boolean;
  requirementsStatus: string | null;
  cardPaymentsStatus: string | null;
};

function publicOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    PRODUCT_ORIGIN
  );
}

/**
 * Create a v2 connected account for a host.
 * Only the properties Stripe's Connect onboarding prompt allows — never pass
 * top-level `type: 'express' | 'standard' | 'custom'`.
 */
export async function createConnectedAccountForHost(host: {
  id: string;
  name: string;
  contactEmail: string | null;
  billingEmail: string | null;
  users: { email: string | null }[];
}): Promise<string> {
  const stripeClient = requireStripeClient();
  const contact =
    host.contactEmail?.trim() ||
    host.billingEmail?.trim() ||
    host.users[0]?.email?.trim();
  if (!contact) {
    throw new Error(
      "Host needs a contact or billing email before Connect onboarding.",
    );
  }

  const account = await stripeClient.v2.core.accounts.create({
    display_name: host.name,
    contact_email: contact,
    identity: {
      country: "us",
    },
    dashboard: "full",
    defaults: {
      responsibilities: {
        fees_collector: "stripe",
        losses_collector: "stripe",
      },
    },
    configuration: {
      customer: {},
      merchant: {
        capabilities: {
          card_payments: {
            requested: true,
          },
        },
      },
    },
  });

  await prisma.host.update({
    where: { id: host.id },
    data: { stripeAccountId: account.id },
  });

  return account.id;
}

/** Always fetch onboarding status from the API (do not persist it). */
export async function retrieveConnectStatus(
  stripeAccountId: string,
): Promise<ConnectOnboardingStatus> {
  const stripeClient = requireStripeClient();
  const account = await stripeClient.v2.core.accounts.retrieve(
    stripeAccountId,
    {
      include: ["configuration.merchant", "requirements"],
    },
  );

  const cardPaymentsStatus =
    account.configuration?.merchant?.capabilities?.card_payments?.status ??
    null;
  const readyToProcessPayments = cardPaymentsStatus === "active";
  const requirementsStatus =
    account.requirements?.summary?.minimum_deadline?.status ?? null;
  const onboardingComplete =
    requirementsStatus !== "currently_due" &&
    requirementsStatus !== "past_due";

  return {
    accountId: account.id,
    displayName: account.display_name ?? null,
    readyToProcessPayments,
    onboardingComplete,
    requirementsStatus,
    cardPaymentsStatus,
  };
}

export async function createAccountOnboardingLink(
  stripeAccountId: string,
): Promise<string> {
  const stripeClient = requireStripeClient();
  const origin = publicOrigin();
  const accountLink = await stripeClient.v2.core.accountLinks.create({
    account: stripeAccountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["merchant", "customer"],
        refresh_url: `${origin}/admin/payments?refresh=1`,
        return_url: `${origin}/admin/payments?accountId=${encodeURIComponent(stripeAccountId)}`,
      },
    },
  });
  if (!accountLink.url) {
    throw new Error("Stripe did not return an Account Link URL.");
  }
  return accountLink.url;
}

/** Create a product on the connected account (Stripe-Account header). */
export async function createProductOnConnectedAccount(opts: {
  accountId: string;
  name: string;
  description?: string;
  priceInCents: number;
  currency?: string;
}) {
  const stripeClient = requireStripeClient();
  return stripeClient.products.create(
    {
      name: opts.name,
      description: opts.description || undefined,
      default_price_data: {
        unit_amount: opts.priceInCents,
        currency: (opts.currency || "usd").toLowerCase(),
      },
    },
    {
      stripeAccount: opts.accountId,
    },
  );
}

export async function listProductsOnConnectedAccount(accountId: string) {
  const stripeClient = requireStripeClient();
  return stripeClient.products.list(
    {
      limit: 20,
      active: true,
      expand: ["data.default_price"],
    },
    {
      stripeAccount: accountId,
    },
  );
}

/**
 * Direct Charge Checkout on the connected account.
 * Stripe's card fee is billed to that account — never to Yall Come Back.
 * application_fee_amount is a YCB stay cut (keep 0).
 */
export async function createDirectChargeCheckout(opts: {
  accountId: string;
  name: string;
  amountCents: number;
  currency?: string;
  quantity?: number;
  successPath: string;
  cancelPath: string;
  metadata?: Record<string, string>;
  customerEmail?: string | null;
}) {
  const stripeClient = requireStripeClient();
  const fee = applicationFeeCents();
  const origin = publicOrigin();
  return stripeClient.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: opts.customerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: (opts.currency || "usd").toLowerCase(),
            product_data: { name: opts.name },
            unit_amount: opts.amountCents,
          },
          quantity: opts.quantity ?? 1,
        },
      ],
      payment_intent_data:
        fee > 0
          ? { application_fee_amount: fee }
          : undefined,
      success_url: `${origin}${opts.successPath}${opts.successPath.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${opts.cancelPath}`,
      metadata: opts.metadata,
    },
    {
      stripeAccount: opts.accountId,
    },
  );
}

/**
 * Charge a hosting subscription to the connected account.
 * V2: use customer_account = acct_... (do not use a v1 customer id).
 */
export async function createHostingSubscriptionCheckout(accountId: string) {
  const stripeClient = requireStripeClient();
  const price = hostingPriceId();
  if (!price) {
    throw new Error(
      "Missing STRIPE_HOSTING_PRICE_ID. Create a recurring Price in the Stripe Dashboard and set the id (price_...) in env.",
    );
  }
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
    customer_account: accountId,
    mode: "subscription",
    line_items,
    success_url: `${origin}/admin/payments?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/admin/payments?canceled=1`,
    metadata: { kind: "hosting_subscription" },
    subscription_data: {
      metadata: { kind: "hosting_subscription" },
    },
  });
}

export async function createBillingPortalSession(accountId: string) {
  const stripeClient = requireStripeClient();
  const origin = publicOrigin();
  return stripeClient.billingPortal.sessions.create({
    customer_account: accountId,
    return_url: `${origin}/admin/payments`,
  });
}

/** Persist subscription status on the host row (customer_account = acct_...). */
export async function applySubscriptionStatusFromStripe(opts: {
  customerAccountId: string | null | undefined;
  subscriptionId?: string | null;
  stripeStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const accountId = opts.customerAccountId?.trim();
  if (!accountId) return null;

  const host = await prisma.host.findUnique({
    where: { stripeAccountId: accountId },
  });
  if (!host) return null;

  const raw = (opts.stripeStatus || "").toLowerCase();
  let subscriptionStatus: "NONE" | "PENDING_PAYMENT" | "ACTIVE" | "PAST_DUE" | "CANCELLED" =
    host.subscriptionStatus;
  if (raw === "active" || raw === "trialing") subscriptionStatus = "ACTIVE";
  else if (raw === "past_due" || raw === "unpaid") subscriptionStatus = "PAST_DUE";
  else if (raw === "canceled" || raw === "incomplete_expired")
    subscriptionStatus = "CANCELLED";
  else if (opts.cancelAtPeriodEnd) subscriptionStatus = "CANCELLED";

  return prisma.host.update({
    where: { id: host.id },
    data: {
      stripeSubscriptionId: opts.subscriptionId || host.stripeSubscriptionId,
      stripeSubscriptionStatus: opts.stripeStatus || host.stripeSubscriptionStatus,
      subscriptionStatus,
    },
  });
}

export function depositCheckoutName(propertyTitle: string): string {
  return `${PRODUCT_NAME} deposit · ${propertyTitle}`;
}

export { toStripeAmount };
