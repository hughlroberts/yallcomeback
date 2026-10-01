/**
 * Stripe Connect (Accounts v2) for *guest* money only.
 *
 * - Each host maps to one v2 connected account (Host.stripeAccountId).
 * - Guest card deposits, extras, and calendar invoices are Direct Charges.
 * - Hosts paying Yall Come Back for hosting use platform-billing.ts
 *   (Customer cus_… + card on the platform account) — never this file.
 */

import { prisma } from "@/lib/db";
import { PRODUCT_DOMAIN, PRODUCT_NAME, PRODUCT_ORIGIN } from "@/lib/features";
import {
  applicationFeeCents,
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

function requestHost(headers: Headers): string | null {
  const raw =
    headers.get("x-forwarded-host") || headers.get("host") || null;
  return raw?.split(",")[0]?.trim().toLowerCase() || null;
}

function originHost(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function envAllowedHosts(): string[] {
  const hosts = new Set<string>([PRODUCT_DOMAIN, `www.${PRODUCT_DOMAIN}`]);
  for (const raw of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.AUTH_URL,
    PRODUCT_ORIGIN,
  ]) {
    if (!raw) continue;
    try {
      hosts.add(new URL(raw).host.toLowerCase());
    } catch {
      /* skip */
    }
  }
  return [...hosts];
}

function hostIsLocal(host: string): boolean {
  const name = host.split(":")[0] ?? host;
  return name === "localhost" || name === "127.0.0.1";
}

/** True when Origin/Referer is this app (CSRF belt-and-suspenders). */
export function isTrustedConnectRequest(headers: Headers): boolean {
  const origin = headers.get("origin");
  const referer = headers.get("referer");
  const candidate = origin || referer;
  if (!candidate) return false;
  const candHost = originHost(candidate);
  if (!candHost) return false;
  const host = requestHost(headers);
  if (host && candHost === host) return true;
  if (
    host &&
    candHost.replace(/^www\./, "") === host.replace(/^www\./, "")
  ) {
    return true;
  }
  if (hostIsLocal(candHost)) return !host || hostIsLocal(host);
  return envAllowedHosts().includes(candHost);
}

/**
 * Return/refresh origin for Connect Account Links.
 * Prefer the page the host is on (local/preview) when that host is trusted.
 */
export function connectOriginFromHeaders(headers: Headers): string {
  const origin = headers.get("origin");
  if (origin && isTrustedConnectRequest(headers)) {
    return origin.replace(/\/$/, "");
  }
  const host = requestHost(headers);
  const proto =
    headers.get("x-forwarded-proto") ||
    (host && hostIsLocal(host) ? "http" : "https");
  if (host) {
    const built = `${proto}://${host}`.replace(/\/$/, "");
    if (hostIsLocal(host) || envAllowedHosts().includes(host)) return built;
    if (origin && isTrustedConnectRequest(headers)) {
      return origin.replace(/\/$/, "");
    }
  }
  return publicOrigin();
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
  origin = publicOrigin(),
): Promise<string> {
  const stripeClient = requireStripeClient();
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

/** Create the connected account if needed, then a hosted onboarding URL. */
export async function createConnectOnboardingUrlForHost(
  host: {
    id: string;
    name: string;
    stripeAccountId: string | null;
    contactEmail: string | null;
    billingEmail: string | null;
    users: { email: string | null }[];
  },
  origin?: string,
): Promise<string> {
  let accountId = host.stripeAccountId;
  if (!accountId) {
    accountId = await createConnectedAccountForHost(host);
  }
  return createAccountOnboardingLink(accountId, origin ?? publicOrigin());
}

export function connectOnboardingErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 280);
  }
  return "Could not start card onboarding.";
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

export function depositCheckoutName(propertyTitle: string): string {
  return `${PRODUCT_NAME} deposit · ${propertyTitle}`;
}

export { toStripeAmount };
