/**
 * T48: internal / QA brands (Host.isTestBrand) must never get a real invoice
 * or charge from Platform admin while live Stripe keys are in use.
 *
 * Only the key prefix is read; the key itself is never logged or returned.
 */
export const TEST_BRAND_LIVE_BILLING_ERROR =
  "This is a test brand. Invoices and charges are off while live Stripe keys are in use.";

/** True when the platform Stripe secret key is a live key (sk_live_ / rk_live_). */
export function stripeLiveKeyInUse(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const key = (env.STRIPE_SECRET_KEY || "").trim();
  return key.startsWith("sk_live_") || key.startsWith("rk_live_");
}

/** True when an admin invoice or charge for this brand must be refused. */
export function testBrandBillingBlocked(
  host: { isTestBrand?: boolean | null },
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(host.isTestBrand) && stripeLiveKeyInUse(env);
}

/** Server-side guard: throws TEST_BRAND_LIVE_BILLING_ERROR when blocked. */
export function assertTestBrandBillingAllowed(host: {
  isTestBrand?: boolean | null;
}): void {
  if (testBrandBillingBlocked(host)) {
    throw new Error(TEST_BRAND_LIVE_BILLING_ERROR);
  }
}
