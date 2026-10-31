"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import type { PublicTaxLine } from "@/lib/tax";
import {
  effectiveMaxPets,
  formatPetFeeRate,
  petFeeUnitLabel,
  type PetFeeUnit,
} from "@/lib/pets";
import { computeBookingQuote, initialPetCount } from "@/lib/booking-quote";
import { AvailabilityCalendar } from "@/components/availability-calendar";
import {
  bookingBarStateFromQuote,
  publishBookingBarState,
  resetBookingBarState,
  setBookingBarAction,
} from "@/lib/booking-bar-state";

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
  /**
   * False when the host can't take the deposit online (no card/Bitcoin ready):
   * show the /book request flow copy instead of "Deposit due now" / "Reserve".
   * Computed server-side with guestDepositDueNow (same check as /book).
   */
  depositDueNow?: boolean;
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

export function BookingWidget({
  propertySlug,
  hostSlug,
  channel = "host_site",
  depositDueNow = true,
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
  const [pets, setPets] = useState(() => initialPetCount(petPolicy, initialPets));
  const [error, setError] = useState<string | null>(null);

  // Plain computation (React Compiler); shared with the server-rendered mobile bar.
  const quote = computeBookingQuote({
    checkIn,
    checkOut,
    pets,
    baseNightlyRate,
    weekendPremiumPercent,
    discountNewListingPercent,
    discountLastMinutePercent,
    discountWeeklyPercent,
    discountMonthlyPercent,
    defaultMinNights,
    cleaningFee,
    petFee,
    petFeeUnit,
    petsAllowed,
    maxPets,
    depositPercent,
    seasons,
    blocked,
    taxLines,
    taxLiabilityAcknowledged,
  });

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

  // Mirror dates/total to the mobile bottom bar and let it start the same flow.
  const onBookRef = useRef(onBook);
  useEffect(() => {
    onBookRef.current = onBook;
  });
  const {
    nights: barNights,
    total: barTotal,
    error: barError,
  } = bookingBarStateFromQuote(checkIn, checkOut, quote);
  useEffect(() => {
    publishBookingBarState({
      checkIn,
      checkOut,
      nights: barNights,
      total: barTotal,
      error: barError,
    });
  }, [checkIn, checkOut, barNights, barTotal, barError]);
  useEffect(() => {
    setBookingBarAction(() => onBookRef.current());
    return () => resetBookingBarState();
  }, []);

  return (
    <div
      id="reserve"
      className="scroll-mt-24 min-w-0 overflow-x-clip rounded-2xl border border-stone-200 bg-white p-4 shadow-lg sm:scroll-mt-28 sm:p-5"
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
            className="mt-1 w-full min-w-0 border-0 bg-transparent p-0 text-base outline-none"
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
              className="mt-1 w-full min-w-0 border-0 bg-transparent p-0 text-base outline-none"
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
            <span>
              {depositDueNow
                ? `Deposit due now (${depositPercent}%)`
                : "Deposit after host approval · nothing charged now"}
            </span>
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
        {depositDueNow ? "Reserve" : "Request to book"}
      </button>
      <p className="mt-2 text-center text-xs text-stone-400">
        {depositDueNow
          ? "You won't be charged until you confirm"
          : "The host reviews your request first"}
      </p>
    </div>
  );
}
