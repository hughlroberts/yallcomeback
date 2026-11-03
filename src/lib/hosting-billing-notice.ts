/**
 * T46 — Platform admin notice after an approval or invoice was asked for a
 * brand that already pays by card each month (the invoice is skipped).
 */
export function invoiceSkippedNotice(
  kind: string | null | undefined,
  brand: string | null | undefined,
): string | null {
  if (kind !== "approved" && kind !== "invoice") return null;
  const who = (brand || "").trim().slice(0, 80) || "This brand";
  const lead = kind === "approved" ? `${who} is approved. ` : "";
  return `${lead}No invoice was sent: ${who} already pays by card each month, so an invoice would bill it twice.`;
}
