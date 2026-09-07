import Stripe from "stripe";
import { STRIPE_LIVE_READY } from "@/lib/features";

/**
 * Stripe Connect client for Yall Come Back.
 *
 * Always construct a Stripe Client (`new Stripe(secret)`) and use that
 * instance for every request. Do not set apiVersion — the SDK pins it.
 *
 * Env (see .env.example — never commit real keys):
 *   STRIPE_ENABLED=true
 *   STRIPE_SECRET_KEY=sk_test_...   // placeholder until Dashboard keys exist
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
 *   STRIPE_WEBHOOK_SECRET=whsec_...           // snapshot events
 *   STRIPE_THIN_WEBHOOK_SECRET=whsec_...      // v2 Connect thin events
 *   STRIPE_HOSTING_PRICE_ID=price_...         // platform hosting subscription
 *   STRIPE_APPLICATION_FEE_CENTS=0            // YCB stay cut — keep 0
 *   STRIPE_PERCENT_BPS=290                    // 2.9% when YCB is merchant
 *   STRIPE_FIXED_FEE_CENTS=30                 // $0.30
 */

function missingKeyMessage(): string {
  return (
    "Stripe is not configured. Set STRIPE_SECRET_KEY to a Dashboard secret " +
    "key (sk_test_... or sk_live_...) in .env / Railway variables, and set " +
    "STRIPE_ENABLED=true. Never commit the key."
  );
}

/** True when ops has flipped the enable flag and a secret key is present. */
export function isStripeConfigured(): boolean {
  return (
    process.env.STRIPE_ENABLED === "true" &&
    Boolean(process.env.STRIPE_SECRET_KEY?.trim())
  );
}

/** Go-live checklist: env keys plus STRIPE_LIVE_READY in features.ts. */
export function isStripeLive(): boolean {
  return STRIPE_LIVE_READY && isStripeConfigured();
}

/**
 * Stripe Client used for all Stripe API calls.
 * Throws a helpful error if the secret key placeholder was left empty.
 */
export function getStripeClient(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error(missingKeyMessage());
  }
  if (secret.startsWith("sk_***") || secret.includes("placeholder")) {
    throw new Error(
      "STRIPE_SECRET_KEY is still a placeholder. Replace sk_*** with a real key from https://dashboard.stripe.com/apikeys",
    );
  }
  // Stripe Client — use this instance for v1 and v2 requests.
  const stripeClient = new Stripe(secret);
  return stripeClient;
}

/** Null when Stripe is disabled — existing call sites that treat Stripe as optional. */
export function getStripe(): Stripe | null {
  if (process.env.STRIPE_ENABLED !== "true") return null;
  try {
    return getStripeClient();
  } catch {
    return null;
  }
}

export function requireStripeClient(): Stripe {
  if (process.env.STRIPE_ENABLED !== "true") {
    throw new Error(
      "Stripe is turned off. Set STRIPE_ENABLED=true after you have test keys.",
    );
  }
  return getStripeClient();
}

/** Amount in major units (USD) → Stripe minor units (cents). */
export function toStripeAmount(amount: number): number {
  return Math.round(amount * 100);
}

export function applicationFeeCents(): number {
  const raw = Number(process.env.STRIPE_APPLICATION_FEE_CENTS || "0");
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.round(raw);
}

/** Basis points of the US card-present rate (290 = 2.9%). */
export function stripePercentBps(): number {
  const n = Number(process.env.STRIPE_PERCENT_BPS || "290");
  return Number.isFinite(n) && n >= 0 ? n : 290;
}

/** Fixed per-charge card fee in cents ($0.30). */
export function stripeFixedFeeCents(): number {
  const n = Number(process.env.STRIPE_FIXED_FEE_CENTS || "30");
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 30;
}

/**
 * Extra cents to charge so the merchant still nets `netCents` after Stripe's
 * percentage + fixed card fee. Used when Yall Come Back is the merchant
 * (hosting / add-on invoices). Guest stay Direct Charges bill the host.
 */
export function processingFeeToNetCents(netCents: number): number {
  if (!Number.isFinite(netCents) || netCents <= 0) return 0;
  const rate = stripePercentBps() / 10000;
  if (rate >= 1) return 0;
  const gross = Math.ceil((netCents + stripeFixedFeeCents()) / (1 - rate));
  return Math.max(0, gross - Math.round(netCents));
}

export const CARD_PROCESSING_LINE = "Card processing";

export function hostingPriceId(): string | null {
  const id = process.env.STRIPE_HOSTING_PRICE_ID?.trim();
  if (!id || id.startsWith("price_***") || id === "price_placeholder") {
    return null;
  }
  return id;
}
