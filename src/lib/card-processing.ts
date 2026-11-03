/**
 * Card processing fee math — pure (no Stripe SDK), so pages and client
 * components can show the same amount hosting checkout adds as its
 * "Card processing" line. Checkout imports these via `@/lib/stripe`.
 */

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
