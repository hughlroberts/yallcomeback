"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import {
  pickBestDiscount,
  rateWithWeekend,
} from "@/lib/listing-discounts";
import { calculateTaxes, type PublicTaxLine } from "@/lib/tax";
import {
  effectiveMaxPets,
  formatPetFeeRate,
  petFeeUnitLabel,
  resolvePetCharges,
  type PetFeeUnit,
} from "@/lib/pets";
import { AvailabilityCalendar } from "@/components/availability-calendar";

type Season = {
  name: string;
  startDate: string;
  endDate: string;
  nightlyRate: number;
  minNights: number;
};

type Props = {
  propertySlug: string;
  hostSlug?: string;
  channel?: "host_site" | "marketplace" | "direct";
  bookBasePath?: string;
  baseNightlyRate: number;
  weekendPremiumPercent?: number;
  discountNewListingPercent?: number;
  discountLastMinutePercent?: number;
  discountWeeklyPercent?: number;
  discountMonthlyPercent?: number;
  defaultMinNights: number;
  cleaningFee: number;
  petFee?: number;
  petFeeUnit?: PetFeeUnit | string;
  petsAllowed?: boolean;
  /** Max pets/dogs; 0 = no fixed cap */
  maxPets?: number;
  depositPercent: number;
  maxGuests: number;
  seasons: Season[];
  blockedDates: string[];
  currencySymbol?: string;
  /** Prefill from marketplace search */
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  initialPets?: number;
  /** Host tax lines (guest-facing); empty if host has not acknowledged liability */
  taxLines?: PublicTaxLine[];
  taxLiabilityAcknowledged?: boolean;
};

function nightsBetween(checkIn: string, checkOut: string) {
  const a = new Date(checkIn + "T00:00:00");
  const b = new Date(checkOut + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function rateForNight(
  night: string,
  base: number,
  seasons: Season[],
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

export function BookingWidget({
  propertySlug,
  hostSlug,
  channel = "host_site",
  bookBasePath,
  baseNightlyRate,
  weekendPremiumPercent = 0,
  discountNewListingPercent = 0,
  discountLastMinutePercent = 0,
  discountWeeklyPercent = 0,
  discountMonthlyPercent = 0,
  defaultMinNights,
  cleaningFee,
  petFee = 0,
  petFeeUnit = "PER_STAY",
  petsAllowed = false,
  maxPets = 0,
  depositPercent,
  maxGuests,
  seasons,
  blockedDates,
  currencySymbol = "$",
  initialCheckIn = "",
  initialCheckOut = "",
  initialGuests,
  initialPets,
  taxLines = [],
  taxLiabilityAcknowledged = false,
}: Props) {
  const router = useRouter();
  const blocked = useMemo(() => new Set(blockedDates), [blockedDates]);
  const petPolicy = useMemo(
    () => ({ petsAllowed, petFee, petFeeUnit, maxPets }),
    [petsAllowed, petFee, petFeeUnit, maxPets],
  );
  const petCap = effectiveMaxPets(petPolicy);
  const money = (n: number) => formatMoney(n, currencySymbol);
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(() => {
    const g = initialGuests ?? 1;
    return Math.min(maxGuests, Math.max(1, g));
  });
  const [pets, setPets] = useState(() => {
    if (!petsAllowed) return 0;
    return Math.min(petCap, Math.max(0, initialPets ?? 0));
  });
  const [error, setError] = useState<string | null>(null);

  const quote = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) return { error: "Check-out must be after check-in" };

    const petCharges = resolvePetCharges(petPolicy, pets);
    if (petCharges.error) {
      return { error: petCharges.error };
    }

    let minNights = defaultMinNights;
    let subtotal = 0;
    const cursor = new Date(checkIn + "T00:00:00");
    for (let i = 0; i < nights; i++) {
      const key = cursor.toISOString().slice(0, 10);
      if (blocked.has(key)) {
        return { error: "Selected dates include unavailable nights" };
      }
      const { rate, minNights: sn } = rateForNight(
        key,
        baseNightlyRate,
        seasons,
        weekendPremiumPercent,
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
        discountNewListingPercent,
        discountLastMinutePercent,
        discountWeeklyPercent,
        discountMonthlyPercent,
      },
      nights,
      new Date(checkIn + "T00:00:00"),
    );
    const discountAmount = discount
      ? Math.round(subtotal * (discount.percent / 100) * 100) / 100
      : 0;
    const afterDiscount =
      Math.round((subtotal - discountAmount) * 100) / 100;

    const appliedPetFee = petCharges.petFee;
    const taxes = calculateTaxes({
      lodgingAmount: afterDiscount,
      cleaningFee,
      petFee: appliedPetFee,
      taxLines,
      liabilityAcknowledged: taxLiabilityAcknowledged,
    });
    const total =
      afterDiscount + cleaningFee + appliedPetFee + taxes.taxAmount;
    const deposit = Math.round(total * (depositPercent / 100) * 100) / 100;
    return {
      nights,
      minNights,
      subtotal,
      discountAmount,
      discountLabel: discount?.label ?? null,
      cleaningFee,
      petFee: appliedPetFee,
      petFeeUnit: petCharges.unit,
      pets: petCharges.pets,
      taxLines: taxes.lines,
      taxAmount: taxes.taxAmount,
      total: Math.round(total * 100) / 100,
      deposit,
    };
  }, [
    checkIn,
    checkOut,
    baseNightlyRate,
    weekendPremiumPercent,
    discountNewListingPercent,
    discountLastMinutePercent,
    discountWeeklyPercent,
    discountMonthlyPercent,
    defaultMinNights,
    cleaningFee,
    petPolicy,
    pets,
    depositPercent,
    seasons,
    blocked,
    taxLines,
    taxLiabilityAcknowledged,
  ]);

  function onBook() {
    setError(null);
    if (!checkIn || !checkOut) {
      setError("Select check-in and check-out dates");
      return;
    }
    if (quote && "error" in quote && quote.error) {
      setError(quote.error);
      return;
    }
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      guests: String(guests),
      pets: String(pets),
      channel,
    });
    if (hostSlug) params.set("host", hostSlug);
    const base = bookBasePath || `/book/${propertySlug}`;
    router.push(`${base}?${params.toString()}`);
  }

  return (
    <div
      id="reserve"
      className="scroll-mt-24 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg sm:scroll-mt-28 sm:p-5"
    >
      <p className="text-xl font-semibold text-stone-900">
        {formatMoney(baseNightlyRate, currencySymbol)}
        <span className="text-base font-normal text-stone-500"> night</span>
      </p>
      <p className="mt-1 text-xs text-stone-500">
        Min{" "}
        {quote && "minNights" in quote && typeof quote.minNights === "number"
          ? quote.minNights
          : defaultMinNights}{" "}
        night
        {(quote && "minNights" in quote && typeof quote.minNights === "number"
          ? quote.minNights
          : defaultMinNights) === 1
          ? ""
          : "s"}
        {quote &&
        "minNights" in quote &&
        typeof quote.minNights === "number" &&
        quote.minNights > defaultMinNights
          ? " (holiday / special dates)"
          : ""}
        {cleaningFee > 0
          ? ` · cleaning ${formatMoney(cleaningFee, currencySymbol)}`
          : ""}
        {petsAllowed && petFee > 0
          ? ` · pet fee ${formatPetFeeRate(petFee, petFeeUnit, money)}`
          : petsAllowed
            ? maxPets > 0
              ? ` · pets OK (max ${maxPets})`
              : " · pets OK"
            : ""}
      </p>

      <div className="mt-4">
        <AvailabilityCalendar
          blockedDates={blockedDates}
          seasonRanges={seasons.map((s) => ({
            name: s.name,
            startDate: s.startDate,
            endDate: s.endDate,
          }))}
          title="Select dates"
          monthsToShow={2}
          compact
          selectable
          checkIn={checkIn}
          checkOut={checkOut}
          onChange={({ checkIn: nextIn, checkOut: nextOut }) => {
            setCheckIn(nextIn);
            setCheckOut(nextOut);
            setError(null);
          }}
        />

      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-stone-300">
        <label className="block p-3">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Guests
          </span>
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="mt-1 w-full border-0 bg-transparent p-0 text-sm outline-none"
          >
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} guest{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        {petsAllowed ? (
          <label className="block border-t border-stone-300 p-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Pets (dogs)
              {maxPets > 0 ? ` · max ${maxPets}` : ""}
            </span>
            <select
              value={Math.min(pets, petCap)}
              onChange={(e) => setPets(Number(e.target.value))}
              className="mt-1 w-full border-0 bg-transparent p-0 text-sm outline-none"
            >
              {Array.from({ length: petCap + 1 }, (_, n) => n).map((n) => {
                const feeHint =
                  n > 0 && petFee > 0
                    ? ` (+${
                        petFeeUnit === "PER_PET"
                          ? money(petFee * n)
                          : money(petFee)
                      } ${petFeeUnitLabel(petFeeUnit)})`
                    : "";
                return (
                  <option key={n} value={n}>
                    {n === 0
                      ? "No pets"
                      : `${n} pet${n === 1 ? "" : "s"}${feeHint}`}
                  </option>
                );
              })}
            </select>
          </label>
        ) : null}
      </div>

      {quote && !("error" in quote && quote.error) && (
        <div className="mt-4 space-y-2 text-sm text-stone-600">
          <div className="flex justify-between">
            <span>
              Lodging × {(quote as { nights: number }).nights} nights
            </span>
            <span>
              {formatMoney((quote as { subtotal: number }).subtotal, currencySymbol)}
            </span>
          </div>
          {(quote as { discountAmount?: number }).discountAmount ? (
            <div className="flex justify-between text-emerald-700">
              <span>
                {(quote as { discountLabel?: string | null }).discountLabel ||
                  "Discount"}
              </span>
              <span>
                −
                {formatMoney(
                  (quote as { discountAmount: number }).discountAmount,
                  currencySymbol,
                )}
              </span>
            </div>
          ) : null}
          {cleaningFee > 0 && (
            <div className="flex justify-between">
              <span>Cleaning fee</span>
              <span>{formatMoney(cleaningFee, currencySymbol)}</span>
            </div>
          )}
          {(quote as { petFee?: number }).petFee ? (
            <div className="flex justify-between">
              <span>
                Pet fee
                {(quote as { pets?: number; petFeeUnit?: string }).pets &&
                (quote as { petFeeUnit?: string }).petFeeUnit === "PER_PET"
                  ? ` (${(quote as { pets: number }).pets} × ${money(petFee)})`
                  : petFee > 0
                    ? ` (${petFeeUnitLabel(petFeeUnit)})`
                    : ""}
              </span>
              <span>
                {formatMoney((quote as { petFee: number }).petFee, currencySymbol)}
              </span>
            </div>
          ) : null}
          {(
            quote as {
              taxLines?: { name: string; ratePercent: number; amount: number }[];
            }
          ).taxLines?.map((t) => (
            <div
              key={`${t.name}-${t.ratePercent}`}
              className="flex justify-between"
            >
              <span>
                {t.name} ({t.ratePercent}%)
              </span>
              <span>{formatMoney(t.amount, currencySymbol)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-stone-200 pt-2 font-semibold text-stone-900">
            <span>Total</span>
            <span>
              {formatMoney((quote as { total: number }).total, currencySymbol)}
            </span>
          </div>
          <div className="flex justify-between text-stone-500">
            <span>Deposit due now ({depositPercent}%)</span>
            <span>
              {formatMoney((quote as { deposit: number }).deposit, currencySymbol)}
            </span>
          </div>
        </div>
      )}

      {(error || (quote && "error" in quote && quote.error)) && (
        <p className="mt-3 text-sm text-red-600">
          {error || (quote as { error?: string }).error}
        </p>
      )}

      <button
        type="button"
        onClick={onBook}
        className="mt-4 min-h-12 w-full rounded-[var(--radius-control)] bg-bonnet py-3.5 text-sm font-semibold text-white hover:bg-bonnet-hover active:bg-bonnet-active"
      >
        Reserve
      </button>
      <p className="mt-2 text-center text-xs text-stone-400">
        You won&apos;t be charged until you confirm
      </p>
    </div>
  );
}
