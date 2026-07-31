/** Default promo amounts shown in the listing wizard (Airbnb-style). */
export const DISCOUNT_DEFAULTS = {
  newListing: 20,
  lastMinute: 6,
  weekly: 10,
  monthly: 25,
} as const;

export type DiscountFields = {
  discountNewListingPercent: number;
  discountLastMinutePercent: number;
  discountWeeklyPercent: number;
  discountMonthlyPercent: number;
};

export type AppliedDiscount = {
  id: "new_listing" | "last_minute" | "weekly" | "monthly";
  label: string;
  percent: number;
};

/**
 * Pick the single best discount that qualifies for this stay.
 * Airbnb rule: only one discount per stay.
 */
export function pickBestDiscount(
  fields: DiscountFields,
  nights: number,
  checkIn: Date,
): AppliedDiscount | null {
  const candidates: AppliedDiscount[] = [];

  if (fields.discountNewListingPercent > 0) {
    candidates.push({
      id: "new_listing",
      label: "New listing promotion",
      percent: fields.discountNewListingPercent,
    });
  }

  if (fields.discountLastMinutePercent > 0) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const daysOut = Math.round(
      (new Date(checkIn).setHours(0, 0, 0, 0) - start.getTime()) / 86400000,
    );
    if (daysOut >= 0 && daysOut <= 14) {
      candidates.push({
        id: "last_minute",
        label: "Last-minute discount",
        percent: fields.discountLastMinutePercent,
      });
    }
  }

  if (fields.discountWeeklyPercent > 0 && nights >= 7) {
    candidates.push({
      id: "weekly",
      label: "Weekly discount",
      percent: fields.discountWeeklyPercent,
    });
  }

  if (fields.discountMonthlyPercent > 0 && nights >= 28) {
    candidates.push({
      id: "monthly",
      label: "Monthly discount",
      percent: fields.discountMonthlyPercent,
    });
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) =>
    c.percent > best.percent ? c : best,
  );
}

export function isWeekendNight(date: Date): boolean {
  const day = date.getDay(); // 0 Sun … 6 Sat
  return day === 5 || day === 6; // Fri, Sat
}

export function rateWithWeekend(
  baseRate: number,
  night: Date,
  weekendPremiumPercent: number,
): number {
  if (weekendPremiumPercent <= 0 || !isWeekendNight(night)) {
    return baseRate;
  }
  return (
    Math.round(baseRate * (1 + weekendPremiumPercent / 100) * 100) / 100
  );
}
