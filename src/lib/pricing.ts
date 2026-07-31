import type { Property, SeasonalPrice } from "@prisma/client";
import { eachNight, nightsBetween, startOfDay } from "./utils";
import {
  pickBestDiscount,
  rateWithWeekend,
  type DiscountFields,
} from "./listing-discounts";
import {
  calculateTaxes,
  type TaxLineInput,
  type TaxLineResult,
} from "./tax";
import { resolvePetCharges, type PetFeeUnit } from "./pets";

export type QuoteInput = {
  property: Pick<
    Property,
    | "baseNightlyRate"
    | "defaultMinNights"
    | "cleaningFee"
    | "petFee"
    | "petsAllowed"
    | "depositPercent"
  > &
    Partial<DiscountFields> & {
      weekendPremiumPercent?: number;
      petFeeUnit?: PetFeeUnit | string | null;
      maxPets?: number | null;
    };
  seasons: Pick<
    SeasonalPrice,
    "startDate" | "endDate" | "nightlyRate" | "minNights" | "name"
  >[];
  checkIn: Date;
  checkOut: Date;
  /** Number of pets; fee uses petFeeUnit (per stay or per pet) */
  pets?: number;
  /** Host tax lines (only applied when taxLiabilityAcknowledged) */
  taxLines?: TaxLineInput[];
  taxLiabilityAcknowledged?: boolean;
};

export type QuoteResult = {
  nights: number;
  nightlyBreakdown: {
    date: string;
    rate: number;
    seasonName: string | null;
    weekend: boolean;
  }[];
  nightlySubtotal: number;
  discountPercent: number;
  discountAmount: number;
  discountLabel: string | null;
  cleaningFee: number;
  petFee: number;
  pets: number;
  taxLines: TaxLineResult[];
  taxAmount: number;
  taxBreakdownJson: string | null;
  totalAmount: number;
  depositAmount: number;
  minNightsRequired: number;
  meetsMinNights: boolean;
  error?: string;
};

function emptyQuote(
  property: QuoteInput["property"],
  pets: number,
  nights: number,
  error?: string,
): QuoteResult {
  return {
    nights,
    nightlyBreakdown: [],
    nightlySubtotal: 0,
    discountPercent: 0,
    discountAmount: 0,
    discountLabel: null,
    cleaningFee: property.cleaningFee,
    petFee: 0,
    pets,
    taxLines: [],
    taxAmount: 0,
    taxBreakdownJson: null,
    totalAmount: 0,
    depositAmount: 0,
    minNightsRequired: property.defaultMinNights,
    meetsMinNights: false,
    error,
  };
}

function seasonForNight(
  night: Date,
  seasons: QuoteInput["seasons"],
): QuoteInput["seasons"][number] | null {
  const n = startOfDay(night).getTime();
  for (const s of seasons) {
    const start = startOfDay(s.startDate).getTime();
    const end = startOfDay(s.endDate).getTime();
    if (n >= start && n <= end) return s;
  }
  return null;
}

export function calculateQuote(input: QuoteInput): QuoteResult {
  const { property, seasons, checkIn, checkOut } = input;
  const petResolved = resolvePetCharges(
    {
      petsAllowed: property.petsAllowed,
      petFee: property.petFee,
      petFeeUnit: property.petFeeUnit,
      maxPets: property.maxPets,
    },
    input.pets ?? 0,
  );
  const pets = petResolved.pets;
  const nights = nightsBetween(checkIn, checkOut);
  const weekendPremium = property.weekendPremiumPercent ?? 0;

  if (nights < 1) {
    return emptyQuote(
      property,
      pets,
      0,
      "Check-out must be after check-in",
    );
  }

  if (petResolved.error) {
    return {
      ...emptyQuote(property, pets, nights, petResolved.error),
      meetsMinNights: true,
    };
  }

  const nightDates = eachNight(checkIn, checkOut);
  let minNightsRequired = property.defaultMinNights;
  const nightlyBreakdown: QuoteResult["nightlyBreakdown"] = [];
  let nightlySubtotal = 0;

  for (const night of nightDates) {
    const season = seasonForNight(night, seasons);
    const base = season?.nightlyRate ?? property.baseNightlyRate;
    const day = startOfDay(night);
    const rate = rateWithWeekend(base, day, weekendPremium);
    if (season) {
      minNightsRequired = Math.max(minNightsRequired, season.minNights);
    }
    nightlySubtotal += rate;
    nightlyBreakdown.push({
      date: day.toISOString().slice(0, 10),
      rate,
      seasonName: season?.name ?? null,
      weekend: day.getDay() === 5 || day.getDay() === 6,
    });
  }

  nightlySubtotal = Math.round(nightlySubtotal * 100) / 100;

  const applied = pickBestDiscount(
    {
      discountNewListingPercent: property.discountNewListingPercent ?? 0,
      discountLastMinutePercent: property.discountLastMinutePercent ?? 0,
      discountWeeklyPercent: property.discountWeeklyPercent ?? 0,
      discountMonthlyPercent: property.discountMonthlyPercent ?? 0,
    },
    nights,
    checkIn,
  );

  const discountPercent = applied?.percent ?? 0;
  const discountAmount =
    discountPercent > 0
      ? Math.round(nightlySubtotal * (discountPercent / 100) * 100) / 100
      : 0;
  const discountedNights = Math.round((nightlySubtotal - discountAmount) * 100) / 100;

  const meetsMinNights = nights >= minNightsRequired;
  const cleaningFee = property.cleaningFee;
  const petFee = petResolved.petFee;

  const taxes = calculateTaxes({
    lodgingAmount: discountedNights,
    cleaningFee,
    petFee,
    taxLines: input.taxLines ?? [],
    liabilityAcknowledged: Boolean(input.taxLiabilityAcknowledged),
  });

  const totalAmount =
    discountedNights + cleaningFee + petFee + taxes.taxAmount;
  const depositAmount =
    Math.round(totalAmount * (property.depositPercent / 100) * 100) / 100;

  return {
    nights,
    nightlyBreakdown,
    nightlySubtotal,
    discountPercent,
    discountAmount,
    discountLabel: applied?.label ?? null,
    cleaningFee,
    petFee,
    pets,
    taxLines: taxes.lines,
    taxAmount: taxes.taxAmount,
    taxBreakdownJson: taxes.taxBreakdownJson,
    totalAmount: Math.round(totalAmount * 100) / 100,
    depositAmount,
    minNightsRequired,
    meetsMinNights,
    error: meetsMinNights
      ? undefined
      : `Minimum stay is ${minNightsRequired} night${minNightsRequired === 1 ? "" : "s"}`,
  };
}

/** Effective disclaimer: property text, else host default */
export function resolveDisclaimer(
  propertyDisclaimer: string | null | undefined,
  hostDefault: string | null | undefined,
): string | null {
  const p = propertyDisclaimer?.trim();
  if (p) return p;
  const h = hostDefault?.trim();
  return h || null;
}
