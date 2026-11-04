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
  // T50: creating the invoice failed; nothing was billed or changed.
  if (kind === "failed-approved" || kind === "failed") {
    const lead = kind === "failed-approved" ? `${who} is approved. ` : "";
    return `${lead}The invoice for ${who} was not created. Nothing was billed and the brand's status and billing period were not changed. Try again, or check the server log for "hosting-invoice".`;
  }
  // T50b: refused before billing — a paid plan came out to $0 (or Stripe's
  // total did not match). Nothing was billed or changed.
  if (kind === "zero-approved" || kind === "zero") {
    const lead = kind === "zero-approved" ? `${who} is approved. ` : "";
    return `${lead}No invoice was sent for ${who}: it came to $0 (or not the plan's price) on a paid plan, so it was refused. Nothing was billed and the brand's status and billing period were not changed. Check the plan and published listings, or the server log for "hosting-invoice".`;
  }
  if (kind !== "approved" && kind !== "invoice") return null;
  const lead = kind === "approved" ? `${who} is approved. ` : "";
  return `${lead}No invoice was sent: ${who} already pays by card each month, so an invoice would bill it twice.`;
}
