import Stripe from "stripe";
import { STRIPE_LIVE_READY } from "@/lib/features";

/**
 * Stripe is intentionally a go-live placeholder.
 * Keep STRIPE_ENABLED=false and empty keys until the owner provides a Stripe
 * account. Then set keys in `.env` only (never commit them) and set
 * STRIPE_LIVE_READY = true in features.ts after webhook smoke-test.
 *
 * Env (see .env.example):
 *   STRIPE_ENABLED=true
 *   STRIPE_SECRET_KEY=sk_...
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 * Webhook path: /api/stripe/webhook
 */

export function isStripeConfigured(): boolean {
  return (
    process.env.STRIPE_ENABLED === "true" &&
    Boolean(process.env.STRIPE_SECRET_KEY)
  );
}

/** True only when env is ready and the go-live checklist flag is set */
export function isStripeLive(): boolean {
  return STRIPE_LIVE_READY && isStripeConfigured();
}

export function getStripe(): Stripe | null {
  if (!isStripeConfigured() || !process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

/** Amount in major units → Stripe minor units (cents) */
export function toStripeAmount(amount: number): number {
  return Math.round(amount * 100);
}
