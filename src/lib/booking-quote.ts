import {
  MAX_STAY_NIGHTS,
  PAST_DATES_ERROR,
  isValidYmd,
} from "@/lib/search-dates";
import { hostTodayYmd } from "@/lib/host-today";

export { PAST_DATES_ERROR };

/** Widget / mobile bar message for a stay over MAX_STAY_NIGHTS. */
export const MAX_STAY_ERROR = `Stays are limited to ${MAX_STAY_NIGHTS} nights`;

/**
 * Guest-facing live quote used by the listing page booking widget.
 * Pure (no server or browser deps) so the server can pre-render the same
 * numbers (e.g. the mobile bottom bar's first paint) that the widget shows.
 */

import { pickBestDiscount, rateWithWeekend } from "@/lib/listing-discounts";
import { calculateTaxes, type PublicTaxLine } from "@/lib/tax";
import {
  effectiveMaxPets,
  resolvePetCharges,
  type PetFeeUnit,
  type PetPolicyInput,
} from "@/lib/pets";
import { extraGuestCharge } from "@/lib/extra-guests";

export type BookingQuoteSeason = {
  name: string;
  startDate: string;
  endDate: string;
  nightlyRate: number;
  minNights: number;
};

export type BookingQuoteInput = {
  checkIn: string;
  checkOut: string;
  pets: number;
  /** Guests on the stay (extra-guest charge); defaults to 1 */
  guests?: number;
  /** Per night per guest beyond extraGuestsIncluded; 0 = none */
  extraGuestFee?: number;
  extraGuestsIncluded?: number;
  baseNightlyRate: number;
  weekendPremiumPercent: number;
  discountNewListingPercent: number;
  discountLastMinutePercent: number;
  discountWeeklyPercent: number;
  discountMonthlyPercent: number;
  defaultMinNights: number;
  cleaningFee: number;
  petFee: number;
  petFeeUnit: PetFeeUnit | string;
  petsAllowed: boolean;
  maxPets: number;
  depositPercent: number;
  seasons: BookingQuoteSeason[];
  blocked: ReadonlySet<string>;
  taxLines: PublicTaxLine[];
  taxLiabilityAcknowledged: boolean;
};

export type BookingQuote = {
  error?: string;
  nights?: number;
  minNights?: number;
  subtotal?: number;
  discountAmount?: number;
  discountLabel?: string | null;
  cleaningFee?: number;
  extraGuestFee?: number;
  extraGuests?: number;
  extraGuestFeePerNight?: number;
  petFee?: number;
  petFeeUnit?: string;
  pets?: number;
  taxLines?: ReturnType<typeof calculateTaxes>["lines"];
  taxAmount?: number;
  total?: number;
  deposit?: number;
};

export function nightsBetween(checkIn: string, checkOut: string) {
  const a = new Date(checkIn + "T00:00:00");
  const b = new Date(checkOut + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function rateForNight(
  night: string,
  base: number,
  seasons: BookingQuoteSeason[],
  weekendPremiumPercent: number,
): { rate: number; minNights: number; seasonName: string | null } {
  const day = new Date(night + "T00:00:00");
  const t = day.getTime();
  for (const s of seasons) {
    const start = new Date(s.startDate.slice(0, 10) + "T00:00:00").getTime();
    const end = new Date(s.endDate.slice(0, 10) + "T00:00:00").getTime();
    if (t >= start && t <= end) {
      return {
        rate: rateWithWeekend(s.nightlyRate, day, weekendPremiumPercent),
        minNights: s.minNights,
        seasonName: s.name,
      };
    }
  }
  return {
    rate: rateWithWeekend(base, day, weekendPremiumPercent),
    minNights: 0,
    seasonName: null,
  };
}

/** Null when dates aren't both set. */
export function computeBookingQuote(input: BookingQuoteInput): BookingQuote | null {
  const { checkIn, checkOut } = input;
  if (!checkIn || !checkOut) return null;
  // E1104-D3: reject impossible calendar days (2026-02-30) — never Date-rollover.
  if (!isValidYmd(checkIn) || !isValidYmd(checkOut)) {
    return { error: "Those dates don't look right. Pick dates in the calendar." };
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (!Number.isFinite(nights)) return { error: "Choose valid dates" };
  if (nights < 1) return { error: "Check-out must be after check-in" };
  // E1104-C1: past check-in (property zone or America/Chicago).
  const today = hostTodayYmd();
  if (isValidYmd(checkIn) && checkIn < today) {
    return { error: PAST_DATES_ERROR, nights };
  }
  // R1104-18: same cap as the search, quote and checkout APIs.
  if (nights > MAX_STAY_NIGHTS) {
    return { error: MAX_STAY_ERROR, nights };
  }

  const petPolicy = {
    petsAllowed: input.petsAllowed,
    petFee: input.petFee,
    petFeeUnit: input.petFeeUnit,
    maxPets: input.maxPets,
  };
  const petCharges = resolvePetCharges(petPolicy, input.pets);
  if (petCharges.error) return { error: petCharges.error };

  let minNights = input.defaultMinNights;
  let subtotal = 0;
  const cursor = new Date(checkIn + "T00:00:00");
  for (let i = 0; i < nights; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (input.blocked.has(key)) {
      return { error: "Selected dates include unavailable nights" };
    }
    const { rate, minNights: sn } = rateForNight(
      key,
      input.baseNightlyRate,
      input.seasons,
      input.weekendPremiumPercent,
    );
    // sn === 0 → no peak min (default only); sn > 0 raises stay min
    if (sn > 0) minNights = Math.max(minNights, sn);
    subtotal += rate;
    cursor.setDate(cursor.getDate() + 1);
  }
  if (nights < minNights) {
    return {
      error: `Minimum stay is ${minNights} night${minNights === 1 ? "" : "s"}`,
      nights,
      minNights,
    };
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const discount = pickBestDiscount(
    {
      discountNewListingPercent: input.discountNewListingPercent,
      discountLastMinutePercent: input.discountLastMinutePercent,
      discountWeeklyPercent: input.discountWeeklyPercent,
      discountMonthlyPercent: input.discountMonthlyPercent,
    },
    nights,
    new Date(checkIn + "T00:00:00"),
  );
  const discountAmount = discount
    ? Math.round(subtotal * (discount.percent / 100) * 100) / 100
    : 0;
  const afterDiscount = Math.round((subtotal - discountAmount) * 100) / 100;

  const appliedPetFee = petCharges.petFee;
  const extra = extraGuestCharge(input, input.guests ?? 1, nights);
  const taxes = calculateTaxes({
    lodgingAmount: afterDiscount + extra.total,
    cleaningFee: input.cleaningFee,
    petFee: appliedPetFee,
    taxLines: input.taxLines,
    liabilityAcknowledged: input.taxLiabilityAcknowledged,
  });
  const total =
    afterDiscount + extra.total + input.cleaningFee + appliedPetFee + taxes.taxAmount;
  const deposit = Math.round(total * (input.depositPercent / 100) * 100) / 100;
  return {
    nights,
    minNights,
    subtotal,
    discountAmount,
    discountLabel: discount?.label ?? null,
    cleaningFee: input.cleaningFee,
    extraGuestFee: extra.total,
    extraGuests: extra.extraGuests,
    extraGuestFeePerNight: extra.perGuestPerNight,
    petFee: appliedPetFee,
    petFeeUnit: petCharges.unit,
    pets: petCharges.pets,
    taxLines: taxes.lines,
    taxAmount: taxes.taxAmount,
    total: Math.round(total * 100) / 100,
    deposit,
  };
}

/** Same clamp the widget applies to a `pets` search param. */
export function initialPetCount(
  policy: PetPolicyInput,
  initialPets: number | undefined,
): number {
  if (!policy.petsAllowed) return 0;
  return Math.min(effectiveMaxPets(policy), Math.max(0, initialPets ?? 0));
}
