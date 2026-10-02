"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bath,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Users,
} from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { AdminBlockSheet } from "@/components/admin-block-sheet";
import {
  addSeason,
  applyPeakHolidays,
  deleteSeason,
  duplicateProperty,
  updatePropertyPricing,
  updateSeason,
} from "@/app/actions/properties";
import {
  DEFAULT_PEAK_MIN_NIGHTS,
  upcomingPeakHolidays,
} from "@/lib/peak-holidays";
import { rateWithWeekend } from "@/lib/listing-discounts";
import {
  visibilityBadgeClass,
  visibilityFromFlags,
  visibilityLabel,
} from "@/lib/listing-visibility";
import { ListingVisibilityForm } from "@/components/listing-visibility-form";
import { cn, formatMoney } from "@/lib/utils";

type Photo = {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  isCover: boolean;
};

type Season = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  nightlyRate: number;
  minNights: number;
  holidayKey: string | null;
};

type Block = {
  id: string;
  startDate: string;
  endDate: string;
  occupantName?: string | null;
  guestCount?: number | null;
  blockType?: string | null;
  source?: string | null;
  connectionName?: string | null;
};
type Booking = {
  id: string;
  checkIn: string;
  checkOut: string;
  status: string;
  guestName?: string | null;
  guests?: number | null;
};

type StayBar = {
  id: string;
  start: string;
  end: string;
  label: string;
  title: string;
  kind: "booking" | "ical" | "block";
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name.trim();
}

function stayPeopleLabel(
  name: string | null | undefined,
  guests: number | null | undefined,
  fallback: string,
) {
  const n = name?.trim();
  if (!n) return fallback;
  const first = firstName(n);
  if (guests && guests > 1) return `${first} + ${guests - 1}`;
  return first;
}

function blockFallback(
  blockType: string | null | undefined,
  source?: string | null,
  connectionName?: string | null,
) {
  if (source === "ICAL_IMPORT") {
    return connectionName?.trim() || "Busy on another site";
  }
  if (blockType === "OWNER") return "Owner";
  if (blockType === "MAINTENANCE") return "Maintenance";
  if (blockType === "FRIENDS") return "Friends";
  return "Blocked";
}

function formatStaySpan(start: string, checkout: string) {
  const a = parseYmd(start);
  const b = parseYmd(checkout);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${a.toLocaleDateString("en-US", opts)} – ${b.toLocaleDateString("en-US", opts)}`;
}

type WorkspaceProperty = {
  id: string;
  title: string;
  slug: string;
  hostSlug: string;
  published: boolean;
  listOnMarketplace: boolean;
  hostMarketplaceOn: boolean;
  city: string | null;
  region: string | null;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  baseNightlyRate: number;
  weekendPremiumPercent: number;
  cleaningFee: number;
  petFee: number;
  petFeeUnit: "PER_STAY" | "PER_PET" | string;
  petsAllowed: boolean;
  maxPets: number;
  defaultMinNights: number;
  images: Photo[];
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Pricing form state is initialized from props. Remount via `key` when
 * property rates change (after save/refresh) instead of syncing in an effect.
 */
function PricingSidebar({
  property,
  seasons,
}: {
  property: WorkspaceProperty;
  seasons: Season[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nightly, setNightly] = useState(String(property.baseNightlyRate));
  const [weekendPct, setWeekendPct] = useState(
    String(property.weekendPremiumPercent),
  );
  const [cleaning, setCleaning] = useState(String(property.cleaningFee));
  const [pet, setPet] = useState(String(property.petFee));
  const [petFeeUnit, setPetFeeUnit] = useState(
    property.petFeeUnit === "PER_PET" ? "PER_PET" : "PER_STAY",
  );
  const [maxPets, setMaxPets] = useState(String(property.maxPets ?? 0));
  const [minNights, setMinNights] = useState(String(property.defaultMinNights));

  function savePricing() {
    setError(null);
    const form = new FormData();
    form.set("propertyId", property.id);
    form.set("baseNightlyRate", nightly);
    form.set("weekendPremiumPercent", weekendPct);
    form.set("cleaningFee", cleaning);
    form.set("petFee", pet);
    form.set("petFeeUnit", petFeeUnit);
    form.set("maxPets", maxPets);
    form.set("defaultMinNights", minNights);
    startTransition(async () => {
      try {
        await updatePropertyPricing(form);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save pricing");
      }
    });
  }

  return (
    <aside className="space-y-3">
      <Card className="!p-0 overflow-hidden">
        <div className="border-b border-stone-100 bg-stone-50/80 px-5 py-3">
          <h3 className="text-base font-semibold text-stone-900">Pricing</h3>
          <p className="text-xs text-stone-500">
            Base rate and weekend premium for this listing.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <Label htmlFor="ws-nightly" className="text-xs text-stone-500">
              Nightly price
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                $
              </span>
              <Input
                id="ws-nightly"
                type="number"
                min={1}
                step="0.01"
                className="h-11 pl-7 text-base font-semibold"
                value={nightly}
                onChange={(e) => setNightly(e.target.value)}
              />
            </div>
            <p className="mt-1 text-[11px] text-stone-400">
              Per night · guests pay this base
            </p>
          </div>

          <div>
            <Label htmlFor="ws-weekend" className="text-xs text-stone-500">
              Weekend premium
            </Label>
            <div className="relative">
              <Input
                id="ws-weekend"
                type="number"
                min={0}
                max={100}
                step="1"
                className="h-11 pr-8"
                value={weekendPct}
                onChange={(e) => setWeekendPct(e.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                %
              </span>
            </div>
            <p className="mt-1 text-[11px] text-stone-400">
              Extra on Fri & Sat (shown on calendar)
            </p>
          </div>

          <div>
            <Label htmlFor="ws-min" className="text-xs text-stone-500">
              Minimum nights
            </Label>
            <Input
              id="ws-min"
              type="number"
              min={1}
              max={30}
              className="h-11"
              value={minNights}
              onChange={(e) => setMinNights(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="border-b border-stone-100 bg-stone-50/80 px-5 py-3">
          <h3 className="text-base font-semibold text-stone-900">
            Additional charges
          </h3>
          <p className="text-[11px] text-stone-500">
            These fees are added to the trip total at checkout.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <Label htmlFor="ws-clean" className="text-xs text-stone-500">
              Cleaning fee
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                $
              </span>
              <Input
                id="ws-clean"
                type="number"
                min={0}
                step="0.01"
                className="h-11 pl-7"
                value={cleaning}
                onChange={(e) => setCleaning(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ws-pet" className="text-xs text-stone-500">
              Pet fee amount
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                $
              </span>
              <Input
                id="ws-pet"
                type="number"
                min={0}
                step="0.01"
                className="h-11 pl-7"
                value={pet}
                onChange={(e) => setPet(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ws-pet-unit" className="text-xs text-stone-500">
              Pet fee unit
            </Label>
            <select
              id="ws-pet-unit"
              className="mt-1 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none focus:border-bonnet focus:ring-2 focus:ring-petal"
              value={petFeeUnit}
              onChange={(e) =>
                setPetFeeUnit(
                  e.target.value === "PER_PET" ? "PER_PET" : "PER_STAY",
                )
              }
            >
              <option value="PER_STAY">Per stay (flat)</option>
              <option value="PER_PET">Per pet (× count)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="ws-max-pets" className="text-xs text-stone-500">
              Max pets (dogs)
            </Label>
            <Input
              id="ws-max-pets"
              type="number"
              min={0}
              max={20}
              step={1}
              className="h-11"
              value={maxPets}
              onChange={(e) => setMaxPets(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-stone-400">
              Default is 2. Raise above 3 if you allow more. 0 = no fixed cap.
              Pets allowed is set on the listing form.
              {property.petsAllowed
                ? " Pets are currently allowed."
                : " Pets are currently not allowed."}
            </p>
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
            <p className="font-medium text-stone-800">Guest total includes</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>Nightly rate × nights</li>
              <li>Cleaning fee</li>
              <li>
                Pet fee if pets (
                {petFeeUnit === "PER_PET" ? "per pet" : "per stay"})
              </li>
              <li>
                Host-wide tax rates (Admin → Earnings → Tax records), not per
                listing
              </li>
            </ul>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button
            type="button"
            className="w-full"
            disabled={pending}
            onClick={savePricing}
          >
            {pending ? "Saving…" : "Save pricing"}
          </Button>
        </div>
      </Card>

      <SeasonOverridesCard
        propertyId={property.id}
        baseNightlyRate={property.baseNightlyRate}
        defaultMinNights={property.defaultMinNights}
        seasons={seasons}
      />
    </aside>
  );
}

function SeasonOverridesCard({
  propertyId,
  baseNightlyRate,
  defaultMinNights,
  seasons,
}: {
  propertyId: string;
  baseNightlyRate: number;
  defaultMinNights: number;
  seasons: Season[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rate, setRate] = useState(String(baseNightlyRate));
  const [minNights, setMinNights] = useState(
    String(Math.max(defaultMinNights, 2)),
  );

  const haveKeys = new Set(
    seasons.map((s) => s.holidayKey).filter((k): k is string => Boolean(k)),
  );
  const missingPeaks = upcomingPeakHolidays().filter((h) => !haveKeys.has(h.key));

  function run(label: string, work: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await work();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : label);
      }
    });
  }

  function saveRow(season: Season, nightlyRate: string, min: string) {
    const form = new FormData();
    form.set("id", season.id);
    form.set("propertyId", propertyId);
    form.set("nightlyRate", nightlyRate);
    form.set("minNights", min);
    run("Could not save override", () => updateSeason(form));
  }

  function removeRow(season: Season) {
    const form = new FormData();
    form.set("id", season.id);
    form.set("propertyId", propertyId);
    run("Could not remove override", () => deleteSeason(form));
  }

  function addRange() {
    const form = new FormData();
    form.set("propertyId", propertyId);
    form.set("name", name.trim() || "Season");
    form.set("startDate", startDate);
    form.set("endDate", endDate);
    form.set("nightlyRate", rate);
    form.set("minNights", minNights);
    run("Could not add range", async () => {
      await addSeason(form);
      setName("");
      setStartDate("");
      setEndDate("");
    });
  }

  function addPeaks() {
    const form = new FormData();
    form.set("propertyId", propertyId);
    form.set("minNights", String(DEFAULT_PEAK_MIN_NIGHTS));
    for (const h of missingPeaks) form.append("holidayKey", h.key);
    run("Could not add peak holidays", () => applyPeakHolidays(form));
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="border-b border-stone-100 bg-stone-50/80 px-5 py-3">
        <h3 className="text-base font-semibold text-stone-900">
          Seasonal overrides
        </h3>
        <p className="text-xs text-stone-500">
          Peak and custom ranges for this listing. Edit here — you stay on
          Calendar.
        </p>
      </div>
      <div className="space-y-3 px-5 py-4">
        {seasons.length === 0 ? (
          <p className="text-xs text-stone-500">
            No date ranges yet. Add a custom range or upcoming US peak holidays.
          </p>
        ) : null}
        {seasons.map((s) => (
          <SeasonOverrideRow
            key={`${s.id}-${s.nightlyRate}-${s.minNights}`}
            season={s}
            disabled={pending}
            onSave={saveRow}
            onRemove={removeRow}
          />
        ))}

        {missingPeaks.length > 0 ? (
          <button
            type="button"
            disabled={pending}
            onClick={addPeaks}
            className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
          >
            Add {missingPeaks.length} upcoming peak holiday
            {missingPeaks.length === 1 ? "" : "s"}
          </button>
        ) : null}

        <div className="space-y-2 border-t border-stone-100 pt-3">
          <p className="text-xs font-medium text-stone-800">Add a date range</p>
          <Input
            placeholder="Name (Labor Day)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 text-sm"
              aria-label="Start date"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 text-sm"
              aria-label="End date"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                $
              </span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="h-9 pl-7 text-sm"
                aria-label="Nightly rate"
              />
            </div>
            <Input
              type="number"
              min={0}
              max={30}
              value={minNights}
              onChange={(e) => setMinNights(e.target.value)}
              className="h-9 text-sm"
              aria-label="Minimum nights"
            />
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={pending || !startDate || !endDate}
            onClick={addRange}
          >
            {pending ? "Saving…" : "Add range"}
          </Button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Card>
  );
}

function SeasonOverrideRow({
  season,
  disabled,
  onSave,
  onRemove,
}: {
  season: Season;
  disabled: boolean;
  onSave: (season: Season, rate: string, min: string) => void;
  onRemove: (season: Season) => void;
}) {
  const [rate, setRate] = useState(String(season.nightlyRate));
  const [min, setMin] = useState(String(season.minNights));
  return (
    <div className="rounded-lg border border-stone-100 px-2.5 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-stone-900">
            {season.name}
            {season.holidayKey ? (
              <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-900">
                Peak
              </span>
            ) : null}
          </p>
          <p className="text-stone-500">
            {parseYmd(season.startDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
            {" – "}
            {parseYmd(season.endDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRemove(season)}
          className="shrink-0 text-[11px] font-medium text-red-600 hover:underline disabled:opacity-60"
        >
          Remove
        </button>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_4.25rem_auto] items-center gap-1.5">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-stone-400">
            $
          </span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="h-8 pl-5 text-xs"
            aria-label={`${season.name} nightly rate`}
          />
        </div>
        <Input
          type="number"
          min={0}
          max={30}
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className="h-8 text-xs"
          aria-label={`${season.name} min nights`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave(season, rate, min)}
          className="text-[11px] font-medium text-bonnet hover:underline disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function priceForDate(
  date: Date,
  baseNightlyRate: number,
  weekendPremiumPercent: number,
  seasons: Season[],
) {
  const day = startOfDay(date);
  const season = seasons.find((s) => {
    const a = startOfDay(parseYmd(s.startDate));
    const b = startOfDay(parseYmd(s.endDate));
    return day >= a && day <= b;
  });
  const base = season?.nightlyRate ?? baseNightlyRate;
  return rateWithWeekend(base, day, weekendPremiumPercent);
}

type CalendarSpan = 1 | 3 | 12;
type CalendarDensity = "full" | "quarter" | "year";

function CalendarMonth({
  year,
  month,
  density,
  stays,
  blockedSet,
  seasons,
  baseNightlyRate,
  weekendPremiumPercent,
  rangeStart,
  rangeEnd,
  today,
  onDayClick,
  onTitleClick,
}: {
  year: number;
  month: number;
  density: CalendarDensity;
  stays: StayBar[];
  blockedSet: Set<string>;
  seasons: Season[];
  baseNightlyRate: number;
  weekendPremiumPercent: number;
  rangeStart: string | null;
  rangeEnd: string | null;
  today: Date;
  onDayClick: (key: string) => void;
  onTitleClick?: () => void;
}) {
  const cells = monthMatrix(year, month);
  const compact = density !== "full";
  const yearView = density === "year";
  const title = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    ...(yearView ? {} : { year: "numeric" }),
  });

  function isInRange(key: string) {
    if (!rangeStart) return false;
    const end = rangeEnd || rangeStart;
    const a = rangeStart <= end ? rangeStart : end;
    const b = rangeStart <= end ? end : rangeStart;
    if (!rangeEnd) return key === rangeStart;
    return key >= a && key < b;
  }

  return (
    <div className="min-w-0">
      {compact ? (
        <button
          type="button"
          onClick={onTitleClick}
          className={cn(
            "mb-1.5 text-left font-semibold text-stone-900 hover:text-bonnet",
            yearView ? "text-sm" : "text-base",
          )}
        >
          {title}
        </button>
      ) : null}
      <div
        className={cn(
          "mb-0.5 grid grid-cols-7",
          yearView ? "gap-px" : "gap-px",
        )}
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className={cn(
              "text-center font-medium uppercase tracking-wide text-stone-400",
              yearView ? "py-0.5 text-[9px]" : "py-1.5 text-[10px] sm:text-xs",
            )}
          >
            {yearView ? d.slice(0, 1) : d}
          </div>
        ))}
      </div>
      <div className={yearView ? "space-y-px" : "overflow-hidden rounded-xl"}>
        {Array.from({ length: 6 }, (_, weekIndex) => {
          const week = cells.slice(weekIndex * 7, weekIndex * 7 + 7);
          const weekStartKey = ymd(week[0]);
          const weekEndKey = ymd(week[6]);
          const weekBars = yearView
            ? []
            : stays
                .map((stay) => {
                  const visStart = stay.start;
                  const visEnd = stay.end;
                  if (visEnd < weekStartKey || visStart > weekEndKey) {
                    return null;
                  }
                  const startCol =
                    visStart <= weekStartKey ? 0 : parseYmd(visStart).getDay();
                  const endCol =
                    visEnd >= weekEndKey ? 6 : parseYmd(visEnd).getDay();
                  if (endCol < startCol) return null;
                  return {
                    ...stay,
                    startCol,
                    span: endCol - startCol + 1,
                    roundLeft: visStart >= weekStartKey,
                    roundRight: visEnd <= weekEndKey,
                    showLabel: visStart >= weekStartKey || startCol === 0,
                  };
                })
                .filter((b): b is NonNullable<typeof b> => b != null);

          return (
            <div
              key={weekStartKey}
              className={cn(
                "relative grid grid-cols-7",
                yearView ? "gap-px" : "mb-1 gap-1 last:mb-0",
              )}
            >
              {week.map((date) => {
                const key = ymd(date);
                const inMonth = date.getMonth() === month;
                const isBlocked = blockedSet.has(key);
                const isToday = key === ymd(today);
                const inRange = isInRange(key);
                const isRangeEdge =
                  key === rangeStart ||
                  (rangeEnd != null && key === rangeEnd);
                const price = priceForDate(
                  date,
                  baseNightlyRate,
                  weekendPremiumPercent,
                  seasons,
                );
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const coveredByBar = weekBars.some(
                  (bar) =>
                    date.getDay() >= bar.startCol &&
                    date.getDay() <= bar.startCol + bar.span - 1,
                );
                const occupied = isBlocked || coveredByBar;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onDayClick(key)}
                    title={
                      occupied
                        ? stays.find(
                            (s) => s.start <= key && s.end >= key,
                          )?.title
                        : undefined
                    }
                    className={cn(
                      "relative flex flex-col items-start text-left transition-colors",
                      yearView
                        ? "h-7 items-center justify-center rounded-md p-0"
                        : density === "quarter"
                          ? "min-h-[3.75rem] rounded-lg p-1 sm:min-h-[4.25rem]"
                          : "min-h-[5.25rem] rounded-xl p-1.5 sm:min-h-[6rem] sm:p-2",
                      !inMonth &&
                        (yearView ? "text-stone-200" : "bg-stone-50 text-stone-300"),
                      inMonth &&
                        !occupied &&
                        !inRange &&
                        (yearView
                          ? "hover:bg-stone-100"
                          : "bg-stone-50 hover:bg-stone-100/80"),
                      inMonth && occupied && !inRange && !yearView && "bg-stone-100",
                      inMonth && occupied && yearView && "bg-stone-500 text-white",
                      inRange && "bg-bonnet/15",
                      isRangeEdge && "ring-2 ring-inset ring-bonnet",
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center justify-center font-medium",
                        yearView ? "size-6 text-[11px]" : "size-6 text-sm sm:size-7",
                        isToday &&
                          !yearView &&
                          "rounded-full bg-bonnet text-white",
                        isToday &&
                          yearView &&
                          !occupied &&
                          "rounded-full bg-bonnet text-white",
                        !isToday && isWeekend && inMonth && !yearView && "text-stone-900",
                        !inMonth && !yearView && "text-stone-300",
                      )}
                    >
                      {inMonth || !yearView ? date.getDate() : ""}
                    </span>
                    {!yearView && !isBlocked && !coveredByBar && inMonth ? (
                      <span
                        className={cn(
                          "mt-0.5 font-semibold tabular-nums text-stone-900",
                          density === "quarter"
                            ? "text-[10px]"
                            : "text-[12px] sm:text-[13px]",
                        )}
                      >
                        {formatMoney(price)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {weekBars.map((bar) => (
                <div
                  key={bar.id}
                  title={bar.title}
                  className={cn(
                    "pointer-events-none absolute z-10 flex items-center overflow-hidden px-1.5 font-semibold text-white shadow-sm",
                    bar.kind === "ical"
                      ? "bg-sky-600"
                      : bar.kind === "booking"
                        ? "bg-bonnet"
                        : "bg-stone-500",
                    density === "quarter"
                      ? "bottom-1 h-5 text-[10px]"
                      : "bottom-2 h-7 px-2 text-[11px] sm:h-8 sm:text-xs",
                    bar.roundLeft && "rounded-l-full",
                    bar.roundRight && "rounded-r-full",
                    !bar.roundLeft && "rounded-l-sm",
                    !bar.roundRight && "rounded-r-sm",
                  )}
                  style={{
                    left: `calc(${bar.startCol} * (100% - 1.5rem) / 7 + ${bar.startCol} * 0.25rem + 0.15rem)`,
                    width: `calc(${bar.span} * (100% - 1.5rem) / 7 + ${bar.span - 1} * 0.25rem - 0.3rem)`,
                  }}
                >
                  {bar.showLabel ? (
                    <span className="truncate">{bar.label}</span>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TabId =
  | "calendar"
  | "insights"
  | "listing"
  | "amenities"
  | "rooms"
  | "photos"
  | "peaks"
  | "blocks"
  | "sync"
  | "cancellation"
  | "messages";

export function AdminListingWorkspace({
  property,
  seasons,
  blocks,
  bookings,
  listingPanel,
  amenitiesPanel,
  roomsPanel,
  photosPanel,
  peaksPanel,
  blocksPanel,
  syncPanel,
  cancellationPanel,
  messagesPanel,
  insightsPanel,
  initialTab,
  calendarOnly = false,
  emailVerified = true,
}: {
  property: WorkspaceProperty;
  seasons: Season[];
  blocks: Block[];
  bookings: Booking[];
  listingPanel?: ReactNode;
  amenitiesPanel?: ReactNode;
  roomsPanel?: ReactNode;
  photosPanel?: ReactNode;
  peaksPanel?: ReactNode;
  blocksPanel?: ReactNode;
  syncPanel?: ReactNode;
  cancellationPanel?: ReactNode;
  messagesPanel?: ReactNode;
  insightsPanel?: ReactNode;
  initialTab?: TabId;
  /** Calendar home: no listing tabs, property switcher lives outside. */
  calendarOnly?: boolean;
  emailVerified?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(
    calendarOnly ? "calendar" : initialTab || "listing",
  );
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  /** Range for blocking: start = check-in, end = checkout (exclusive). */
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [blockSheetOpen, setBlockSheetOpen] = useState(false);
  const [monthsShown, setMonthsShown] = useState<CalendarSpan>(1);

  const blockedSet = useMemo(() => {
    const local = new Set<string>();
    const ranges = [
      ...blocks,
      ...bookings
        .filter((b) =>
          ["CONFIRMED", "PENDING_PAYMENT", "COMPLETED"].includes(b.status),
        )
        .map((b) => ({ startDate: b.checkIn, endDate: b.checkOut })),
    ];
    for (const r of ranges) {
      const cur = startOfDay(parseYmd(r.startDate));
      const end = startOfDay(parseYmd(r.endDate));
      while (cur < end) {
        local.add(ymd(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
    return local;
  }, [blocks, bookings]);

  const stays: StayBar[] = useMemo(() => {
    const fromBlocks: StayBar[] = blocks.map((b) => {
      const kind: StayBar["kind"] =
        b.source === "ICAL_IMPORT" ? "ical" : "block";
      const label = stayPeopleLabel(
        b.occupantName,
        b.guestCount,
        blockFallback(b.blockType, b.source, b.connectionName),
      );
      const span = formatStaySpan(b.startDate, b.endDate);
      return {
        id: `block-${b.id}`,
        start: b.startDate,
        end: b.endDate,
        label,
        title: `${b.occupantName?.trim() || label} · ${span}`,
        kind,
      };
    });
    const fromBookings: StayBar[] = bookings
      .filter((b) =>
        ["CONFIRMED", "PENDING_PAYMENT", "COMPLETED"].includes(b.status),
      )
      .map((b) => {
        const label = stayPeopleLabel(b.guestName, b.guests, "Guest");
        const span = formatStaySpan(b.checkIn, b.checkOut);
        return {
          id: `booking-${b.id}`,
          start: b.checkIn,
          end: b.checkOut,
          label,
          title: `${b.guestName?.trim() || label} · ${span}`,
          kind: "booking",
        };
      });
    return [...fromBlocks, ...fromBookings];
  }, [blocks, bookings]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = startOfDay(new Date());
  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const monthsToRender =
    monthsShown === 12
      ? Array.from({ length: 12 }, (_, i) => new Date(year, i, 1))
      : Array.from(
          { length: monthsShown },
          (_, i) => new Date(year, month + i, 1),
        );
  const spanLabel =
    monthsShown === 12
      ? String(year)
      : monthsShown === 3
        ? `${monthsToRender[0].toLocaleDateString("en-US", { month: "short" })} – ${monthsToRender[2].toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
        : monthLabel;
  const density: CalendarDensity =
    monthsShown === 12 ? "year" : monthsShown === 3 ? "quarter" : "full";
  const wideCalendar = monthsShown !== 1;

  function stepCursor(dir: -1 | 1) {
    if (monthsShown === 12) {
      setCursor(new Date(year + dir, 0, 1));
      return;
    }
    setCursor(new Date(year, month + dir * monthsShown, 1));
  }

  const photos = [...property.images].sort((a, b) => {
    if (a.isCover !== b.isCover) return a.isCover ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
  const cover = photos[0]?.url ?? null;

  const selectedPrice =
    selectedDay != null
      ? priceForDate(
          parseYmd(selectedDay),
          property.baseNightlyRate,
          property.weekendPremiumPercent,
          seasons,
        )
      : null;
  const selectedBlocked = selectedDay != null && blockedSet.has(selectedDay);

  function addDaysYmd(s: string, days: number) {
    const d = parseYmd(s);
    d.setDate(d.getDate() + days);
    return ymd(d);
  }

  function onDayClick(key: string) {
    setSelectedDay(key);

    // Past and future nights are both selectable so hosts can log
    // leftover stays and edit history. Range: 1st click = start, 2nd = checkout.
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(key);
      setRangeEnd(null);
      setBlockSheetOpen(false);
      return;
    }
    // Second click
    if (key === rangeStart) {
      // Same day → block 1 night (checkout = next day)
      setRangeEnd(addDaysYmd(key, 1));
      setBlockSheetOpen(true);
      return;
    }
    if (key < rangeStart) {
      // New start earlier
      setRangeStart(key);
      setRangeEnd(null);
      setBlockSheetOpen(false);
      return;
    }
    // key > rangeStart → key is checkout day
    setRangeEnd(key);
    setBlockSheetOpen(true);
  }

  function closeBlockSheet() {
    setBlockSheetOpen(false);
  }

  function clearRange() {
    setRangeStart(null);
    setRangeEnd(null);
    setBlockSheetOpen(false);
  }

  function openSheetForSelection() {
    if (!rangeStart) return;
    if (!rangeEnd) {
      setRangeEnd(addDaysYmd(rangeStart, 1));
    }
    setBlockSheetOpen(true);
  }

  const pricingKey = [
    property.baseNightlyRate,
    property.weekendPremiumPercent,
    property.cleaningFee,
    property.petFee,
    property.petFeeUnit,
    property.maxPets,
    property.defaultMinNights,
  ].join(":");

  const visibility = visibilityFromFlags(
    property.published,
    property.listOnMarketplace,
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "calendar", label: "Calendar" },
    ...(insightsPanel
      ? ([{ id: "insights" as const, label: "Insights" }] as const)
      : []),
    { id: "listing", label: "Listing" },
    { id: "amenities", label: "Amenities" },
    { id: "rooms", label: "Rooms & beds" },
    { id: "photos", label: "Photos" },
    { id: "peaks", label: "Peak dates" },
    { id: "blocks", label: "Blocks" },
    { id: "sync", label: "Sync" },
    ...(cancellationPanel
      ? ([{ id: "cancellation" as const, label: "Cancellation" }] as const)
      : []),
    ...(messagesPanel
      ? ([{ id: "messages" as const, label: "Messages" }] as const)
      : []),
  ];

  return (
    <div className="space-y-4">
      {calendarOnly ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                {property.title}
              </h1>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  visibilityBadgeClass(visibility),
                )}
              >
                {visibilityLabel(visibility)}
              </span>
            </div>
            <p className="mt-1 text-sm text-stone-500">
              Prices, availability, and busy nights from other sites.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/properties/${property.id}?tab=sync`}
              className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Airbnb / VRBO
            </Link>
            <Link
              href={`/admin/properties/${property.id}`}
              className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Edit listing
            </Link>
          </div>
        </div>
      ) : (
      <>
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
              {property.title}
            </h1>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                visibilityBadgeClass(visibility),
              )}
            >
              {visibilityLabel(visibility)}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-500">
            {[property.city, property.region].filter(Boolean).join(", ") ||
              "Location not set"}
            <span className="mx-1.5 text-stone-300">·</span>
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-3.5" />
              {property.bedrooms}
            </span>
            <span className="mx-1.5 text-stone-300">·</span>
            <span className="inline-flex items-center gap-1">
              <Bath className="size-3.5" />
              {property.bathrooms}
            </span>
            <span className="mx-1.5 text-stone-300">·</span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {property.maxGuests} guests
            </span>
          </p>
          {visibility === "off" ? (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              This stay is off. Guests cannot book it on your website or on Find
              a Place. Use <strong>Taking bookings</strong> to turn it on.
            </p>
          ) : (
            <p className="mt-1 text-xs text-stone-400">
              {visibility === "website" || visibility === "both" ? (
                <>
                  Website:{" "}
                  <Link
                    href={`/h/${property.hostSlug}/properties/${property.slug}`}
                    className="text-bonnet hover:underline"
                    target="_blank"
                  >
                    /h/{property.hostSlug}/properties/{property.slug}
                  </Link>
                </>
              ) : null}
              {visibility === "both" ? (
                <>
                  <span className="mx-1.5 text-stone-300">·</span>
                  Find a Place:{" "}
                  <Link
                    href={`/marketplace/properties/${property.slug}?host=${property.hostSlug}`}
                    className="text-bonnet hover:underline"
                    target="_blank"
                  >
                    /marketplace/properties/{property.slug}
                  </Link>
                </>
              ) : null}
            </p>
          )}
        </div>
        <div className="w-full shrink-0 lg:w-80">
          <ListingVisibilityForm
            propertyId={property.id}
            published={property.published}
            listOnMarketplace={property.listOnMarketplace}
            hostMarketplaceOn={property.hostMarketplaceOn}
            emailVerified={emailVerified}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
          <form action={duplicateProperty}>
            <input type="hidden" name="propertyId" value={property.id} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg border border-lupine/50 bg-porcelain px-3 py-1.5 text-sm font-medium text-bonnet hover:bg-petal"
              title="Create a draft copy with the same details, photos, amenities, and rates"
            >
              Duplicate
            </button>
          </form>
          <Link
            href={`/admin/properties/${property.id}/setup`}
            className="inline-flex items-center justify-center rounded-lg border border-lupine/50 bg-porcelain px-3 py-1.5 text-sm font-medium text-bonnet hover:bg-petal"
          >
            Setup wizard
          </Link>
          <Link
            href={`/admin/magnets/${property.id}`}
            className="inline-flex items-center justify-center rounded-lg border border-lupine/50 bg-porcelain px-3 py-1.5 text-sm font-medium text-bonnet hover:bg-petal"
            title="Print a one-page QR fridge magnet for this stay"
          >
            Fridge magnet
          </Link>
          {visibility !== "off" ? (
            <Link
              href={
                visibility === "both"
                  ? `/marketplace/properties/${property.slug}?host=${property.hostSlug}`
                  : `/h/${property.hostSlug}/properties/${property.slug}`
              }
              target="_blank"
              className="inline-flex items-center justify-center rounded-lg bg-bonnet px-3 py-1.5 text-sm font-medium text-white hover:bg-bonnet-hover"
            >
              View listing
            </Link>
          ) : null}
        </div>

      {/* Sub-nav */}
      <div className="flex gap-1 overflow-x-auto border-b border-stone-200 pb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-bonnet text-bonnet"
                : "border-transparent text-stone-500 hover:text-stone-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      </>
      )}

      {tab === "calendar" ? (
        <div
          className={cn(
            "grid gap-4",
            wideCalendar
              ? "grid-cols-1"
              : calendarOnly
                ? "lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]"
                : "lg:grid-cols-[88px_minmax(0,1fr)_300px] xl:grid-cols-[96px_minmax(0,1fr)_320px]",
          )}
        >
          {/* Left photo strip */}
          <aside
            className={cn(
              "hidden flex-col gap-2 lg:flex",
              (wideCalendar || calendarOnly) && "!hidden",
            )}
          >
            {cover ? (
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm">
                <Image src={cover} alt="" fill className="object-cover" sizes="96px" />
              </div>
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50">
                <ImageIcon className="size-6 text-stone-400" />
              </div>
            )}
            {photos.slice(1, 5).map((p) => (
              <div
                key={p.id}
                className="relative aspect-square w-full overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
              >
                <Image
                  src={p.url}
                  alt={p.alt || ""}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </div>
            ))}
            {photos.length > 5 ? (
              <button
                type="button"
                onClick={() => setTab("photos")}
                className="rounded-lg border border-stone-200 py-2 text-center text-[11px] font-medium text-stone-500 hover:bg-stone-50"
              >
                +{photos.length - 5} more
              </button>
            ) : photos.length === 0 ? (
              <button
                type="button"
                onClick={() => setTab("photos")}
                className="rounded-lg border border-dashed border-stone-300 py-3 text-center text-[11px] font-medium text-stone-500 hover:bg-stone-50"
              >
                Add photos
              </button>
            ) : null}
          </aside>

          {/* Center calendar */}
          <section className="min-w-0 rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-100"
                  onClick={() => stepCursor(-1)}
                  aria-label="Previous"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <h2 className="min-w-[10rem] text-center text-lg font-semibold tracking-tight text-stone-900">
                  {spanLabel}
                </h2>
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-100"
                  onClick={() => stepCursor(1)}
                  aria-label="Next"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-emerald-500" /> Available
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-bonnet" /> Stay
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-sky-600" /> Busy elsewhere
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-stone-500" /> Blocked
                </span>
                <div className="inline-flex rounded-full border border-stone-200 bg-stone-50 p-0.5">
                  {([1, 3, 12] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setMonthsShown(n);
                        if (n === 12) {
                          setCursor(new Date(year, 0, 1));
                        }
                      }}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        monthsShown === n
                          ? "bg-white text-stone-900 shadow-sm"
                          : "text-stone-500 hover:text-stone-800",
                      )}
                    >
                      {n === 12 ? "12 months" : n === 3 ? "3 months" : "1 month"}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  onClick={() => {
                    const n = new Date();
                    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
                    setMonthsShown(1);
                  }}
                >
                  Today
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <div
                className={cn(
                  monthsShown === 12 &&
                    "grid gap-6 sm:grid-cols-2 lg:grid-cols-4",
                  monthsShown === 3 && "grid gap-6 lg:grid-cols-3",
                )}
              >
                {monthsToRender.map((d) => (
                  <CalendarMonth
                    key={`${d.getFullYear()}-${d.getMonth()}`}
                    year={d.getFullYear()}
                    month={d.getMonth()}
                    density={density}
                    stays={stays}
                    blockedSet={blockedSet}
                    seasons={seasons}
                    baseNightlyRate={property.baseNightlyRate}
                    weekendPremiumPercent={property.weekendPremiumPercent}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    today={today}
                    onDayClick={onDayClick}
                    onTitleClick={
                      monthsShown === 1
                        ? undefined
                        : () => {
                            setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                            setMonthsShown(1);
                          }
                    }
                  />
                ))}
              </div>

              {rangeStart ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-stone-900">
                      {rangeEnd
                        ? `${parseYmd(rangeStart).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })} → ${parseYmd(rangeEnd).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}`
                        : parseYmd(rangeStart).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                    </p>
                    <p className="text-stone-500">
                      {rangeEnd
                        ? "Range selected — block from the sheet or adjust dates."
                        : selectedBlocked
                          ? "This night is blocked or booked. Tap another day for checkout, or open block sheet for 1 night."
                          : selectedPrice != null
                            ? `${formatMoney(selectedPrice)} / night · tap a second day for checkout, or Block 1 night`
                            : "Tap a second day (checkout) to finish the range."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="!px-3 !py-1.5 text-xs"
                      onClick={clearRange}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      className="!px-3 !py-1.5 text-xs"
                      onClick={openSheetForSelection}
                    >
                      {rangeEnd ? "Manage blocks" : "Block 1 night"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-center text-sm text-stone-400">
                  Tap a start date, then a checkout day — or one day and{" "}
                  <strong className="font-medium text-stone-600">
                    Block 1 night
                  </strong>
                  .
                </p>
              )}
            </div>
          </section>

          <AdminBlockSheet
            open={blockSheetOpen && Boolean(rangeStart)}
            propertyId={property.id}
            baseNightlyRate={property.baseNightlyRate}
            startDate={rangeStart || ymd(today)}
            endDate={
              rangeEnd ||
              (rangeStart ? addDaysYmd(rangeStart, 1) : ymd(today))
            }
            onClose={closeBlockSheet}
            onOpenFullBlocks={() => {
              closeBlockSheet();
              if (calendarOnly) {
                router.push(`/admin/properties/${property.id}?tab=blocks`);
                return;
              }
              setTab("blocks");
            }}
          />

          {wideCalendar ? null : (
            <PricingSidebar
              key={pricingKey}
              property={property}
              seasons={seasons}
            />
          )}
        </div>
      ) : null}

      {tab === "insights" && insightsPanel ? (
        <div className="max-w-4xl">{insightsPanel}</div>
      ) : null}
      {tab === "listing" ? <div className="max-w-3xl">{listingPanel}</div> : null}
      {tab === "amenities" ? (
        <div className="max-w-3xl">{amenitiesPanel}</div>
      ) : null}
      {tab === "rooms" ? <div className="max-w-3xl">{roomsPanel}</div> : null}
      {tab === "photos" ? <div className="max-w-3xl">{photosPanel}</div> : null}
      {tab === "peaks" ? <div className="max-w-3xl">{peaksPanel}</div> : null}
      {tab === "blocks" ? <div className="max-w-3xl">{blocksPanel}</div> : null}
      {tab === "sync" ? <div className="max-w-3xl">{syncPanel}</div> : null}
      {tab === "cancellation" && cancellationPanel ? (
        <div className="max-w-3xl">{cancellationPanel}</div>
      ) : null}
      {tab === "messages" && messagesPanel ? (
        <div className="max-w-3xl">{messagesPanel}</div>
      ) : null}
    </div>
  );
}
