/**
 * Host-level taxes for guest quotes (not per listing).
 * One host brand → one set of rates applied to every property under that host.
 * Yall Come Back does not collect or remit tax for hosts - calculation only.
 */

export const TAX_LIABILITY_WARNING = `IMPORTANT TAX DISCLAIMER

Yall Come Back and this software do not collect, withhold, remit, or file taxes on your behalf. We are not a tax advisor, CPA, or government agency.

You alone are responsible for:
• Determining which taxes apply to your rentals (e.g. hotel occupancy tax, sales tax)
• Setting accurate rates and taxable bases in your tax configuration
• Collecting the correct amounts from guests
• Filing and remitting all taxes to the appropriate authorities on time
• Keeping records for audits

Yall Come Back, its operators, and contributors are not liable for incorrect rates, missed filings, penalties, interest, or any tax-related claims arising from your use of these tools. If you are unsure about your obligations, consult a qualified tax professional or your local taxing authority.`;

export type TaxLineInput = {
  name: string;
  ratePercent: number;
  applyToLodging?: boolean;
  applyToCleaning?: boolean;
  applyToPetFee?: boolean;
  active?: boolean;
};

export type TaxLineResult = {
  name: string;
  ratePercent: number;
  taxableBase: number;
  amount: number;
};

export type TaxCalculation = {
  lines: TaxLineResult[];
  taxAmount: number;
  /** JSON string for booking snapshot */
  taxBreakdownJson: string | null;
};

export function calculateTaxes(opts: {
  lodgingAmount: number;
  cleaningFee: number;
  petFee: number;
  taxLines: TaxLineInput[];
  /** Taxes only apply after host acknowledges liability */
  liabilityAcknowledged: boolean;
}): TaxCalculation {
  if (!opts.liabilityAcknowledged) {
    return { lines: [], taxAmount: 0, taxBreakdownJson: null };
  }

  const lines: TaxLineResult[] = [];

  for (const line of opts.taxLines) {
    if (line.active === false) continue;
    const rate = Number(line.ratePercent);
    if (!Number.isFinite(rate) || rate <= 0) continue;

    let base = 0;
    if (line.applyToLodging !== false) {
      base += Math.max(0, opts.lodgingAmount);
    }
    if (line.applyToCleaning) {
      base += Math.max(0, opts.cleaningFee);
    }
    if (line.applyToPetFee) {
      base += Math.max(0, opts.petFee);
    }
    base = Math.round(base * 100) / 100;
    if (base <= 0) continue;

    const amount = Math.round(base * (rate / 100) * 100) / 100;
    if (amount <= 0) continue;

    lines.push({
      name: line.name.trim() || "Tax",
      ratePercent: rate,
      taxableBase: base,
      amount,
    });
  }

  const taxAmount =
    Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;

  return {
    lines,
    taxAmount,
    taxBreakdownJson:
      lines.length > 0
        ? JSON.stringify(
            lines.map((l) => ({
              name: l.name,
              ratePercent: l.ratePercent,
              amount: l.amount,
            })),
          )
        : null,
  };
}

export function parseTaxBreakdown(
  raw: string | null | undefined,
): { name: string; ratePercent: number; amount: number }[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          name: String(r.name || "Tax"),
          ratePercent: Number(r.ratePercent) || 0,
          amount: Number(r.amount) || 0,
        };
      })
      .filter((r) => r.amount > 0);
  } catch {
    return [];
  }
}

/** Serialize tax lines for client components (booking widget). */
export type PublicTaxLine = {
  name: string;
  ratePercent: number;
  applyToLodging: boolean;
  applyToCleaning: boolean;
  applyToPetFee: boolean;
};
