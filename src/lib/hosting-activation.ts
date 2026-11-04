/**
 * T48(2): a hosting invoice only makes a brand ACTIVE / paid-up when real
 * money was paid on a real brand. A $0 invoice (Stripe auto-marks $0 invoices
 * paid) or any invoice on an internal/QA brand (Host.isTestBrand) never does.
 */
export function invoicePaymentActivatesHosting(
  invoice: { amount: number | null | undefined },
  host: { isTestBrand?: boolean | null } | null | undefined,
): boolean {
  if (!host || host.isTestBrand) return false;
  return Number(invoice.amount ?? 0) > 0;
}

/** Status a brand gets when an invoice is recorded but does NOT activate it:
 * an already-ACTIVE brand stays ACTIVE, anything else is PENDING_PAYMENT. */
export function statusWithoutActivation(current: string | null | undefined) {
  return current === "ACTIVE" ? "ACTIVE" : "PENDING_PAYMENT";
}
