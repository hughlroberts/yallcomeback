/**
 * T46 — Platform admin notice after an approval or invoice was asked for a
 * brand that already pays by card each month (the invoice is skipped).
 */
export function invoiceSkippedNotice(
  kind: string | null | undefined,
  brand: string | null | undefined,
): string | null {
  const who = (brand || "").trim().slice(0, 80) || "This brand";
  // T48: internal / QA brand while live Stripe keys are in use.
  if (kind === "test-approved" || kind === "test") {
    const lead = kind === "test-approved" ? `${who} is approved. ` : "";
    return `${lead}No invoice was sent: ${who} is a test brand and live Stripe keys are in use, so invoices and charges are off for it.`;
  }
  if (kind !== "approved" && kind !== "invoice") return null;
  const lead = kind === "approved" ? `${who} is approved. ` : "";
  return `${lead}No invoice was sent: ${who} already pays by card each month, so an invoice would bill it twice.`;
}
