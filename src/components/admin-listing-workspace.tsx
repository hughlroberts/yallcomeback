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
  duplicateProperty,
  updatePropertyPricing,
} from "@/app/actions/properties";
import { rateWithWeekend } from "@/lib/listing-discounts";
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

type Block = { startDate: string; endDate: string };
type Booking = { checkIn: string; checkOut: string; status: string };

type WorkspaceProperty = {
  id: string;
  title: string;
  slug: string;
  hostSlug: string;
  published: boolean;
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
  onOpenPeaks,
}: {
  property: WorkspaceProperty;
  seasons: Season[];
  onOpenPeaks: () => void;
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
              <li>Host-wide tax rates (Admin → Taxes), not per listing</li>
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

      {seasons.length > 0 ? (
        <Card>
          <h3 className="text-sm font-semibold text-stone-900">
            Seasonal overrides
          </h3>
          <div className="mt-3 space-y-2">
            {seasons.slice(0, 6).map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-stone-100 px-2.5 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-900">
                    {s.name}
                    {s.holidayKey ? (
                      <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-900">
                        Peak
                      </span>
                    ) : null}
                  </p>
                  <p className="text-stone-500">
                    {parseYmd(s.startDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {" – "}
                    {parseYmd(s.endDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums text-stone-900">
                    {formatMoney(s.nightlyRate)}
                  </p>
                  <p className="text-stone-500">{s.minNights} nt min</p>
                </div>
              </div>
            ))}
            {seasons.length > 6 ? (
              <button
                type="button"
                onClick={onOpenPeaks}
                className="w-full text-center text-xs font-medium text-bonnet hover:underline"
              >
                View all ({seasons.length})
              </button>
            ) : null}
          </div>
        </Card>
      ) : null}
    </aside>
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
}: {
  property: WorkspaceProperty;
  seasons: Season[];
  blocks: Block[];
  bookings: Booking[];
  listingPanel: ReactNode;
  amenitiesPanel: ReactNode;
  roomsPanel: ReactNode;
  photosPanel: ReactNode;
  peaksPanel: ReactNode;
  blocksPanel: ReactNode;
  syncPanel: ReactNode;
  cancellationPanel?: ReactNode;
  messagesPanel?: ReactNode;
  insightsPanel?: ReactNode;
  initialTab?: TabId;
}) {
  const [tab, setTab] = useState<TabId>(initialTab || "calendar");
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  /** Range for blocking: start = check-in, end = checkout (exclusive). */
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [blockSheetOpen, setBlockSheetOpen] = useState(false);

  const blockedSet = useMemo(() => {
    const local = new Set<string>();
    const ranges = [
      ...blocks,
      ...bookings
        .filter((b) =>
          ["CONFIRMED", "PENDING_PAYMENT"].includes(b.status),
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

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = monthMatrix(year, month);
  const today = startOfDay(new Date());
  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

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

  function isInRange(key: string) {
    if (!rangeStart) return false;
    const end = rangeEnd || rangeStart;
    const a = rangeStart <= end ? rangeStart : end;
    const b = rangeStart <= end ? end : rangeStart;
    // highlight nights [start, checkout) — if only start, just that night
    if (!rangeEnd) return key === rangeStart;
    return key >= a && key < b;
  }

  function onDayClick(key: string, inMonth: boolean) {
    if (!inMonth) return;
    setSelectedDay(key);

    // Range select: 1st click = start, 2nd = checkout end → open sheet
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
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
              {property.title}
            </h1>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                property.published
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-stone-100 text-stone-600",
              )}
            >
              {property.published ? "Published" : "Draft"}
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
          <p className="mt-1 text-xs text-stone-400">
            Public listing:{" "}
            <Link
              href={`/marketplace/properties/${property.slug}?host=${property.hostSlug}`}
              className="text-bonnet hover:underline"
              target="_blank"
            >
              /marketplace/properties/{property.slug}
            </Link>
          </p>
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
          <Link
            href={`/marketplace/properties/${property.slug}?host=${property.hostSlug}`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-lg bg-bonnet px-3 py-1.5 text-sm font-medium text-white hover:bg-bonnet-hover"
          >
            View listing
          </Link>
        </div>
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

      {tab === "calendar" ? (
        <div className="grid gap-4 lg:grid-cols-[88px_minmax(0,1fr)_300px] xl:grid-cols-[96px_minmax(0,1fr)_320px]">
          {/* Left photo strip */}
          <aside className="hidden flex-col gap-2 lg:flex">
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
                  onClick={() => setCursor(new Date(year, month - 1, 1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <h2 className="min-w-[10rem] text-center text-lg font-semibold tracking-tight text-stone-900">
                  {monthLabel}
                </h2>
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-100"
                  onClick={() => setCursor(new Date(year, month + 1, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-emerald-500" /> Available
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-stone-300" /> Blocked
                </span>
                <button
                  type="button"
                  className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  onClick={() => {
                    const n = new Date();
                    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
                  }}
                >
                  Today
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <div className="mb-1 grid grid-cols-7 gap-px">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-medium uppercase tracking-wide text-stone-400"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200/60">
                {cells.map((date) => {
                  const key = ymd(date);
                  const inMonth = date.getMonth() === month;
                  const isPast = startOfDay(date) < today;
                  const isBlocked = blockedSet.has(key);
                  const isToday = key === ymd(today);
                  const inRange = inMonth && isInRange(key);
                  const isRangeEdge =
                    inMonth &&
                    (key === rangeStart ||
                      (rangeEnd != null && key === rangeEnd));
                  const price = priceForDate(
                    date,
                    property.baseNightlyRate,
                    property.weekendPremiumPercent,
                    seasons,
                  );
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!inMonth}
                      onClick={() => onDayClick(key, inMonth)}
                      className={cn(
                        "relative flex min-h-[4.75rem] flex-col items-start p-1.5 text-left transition-colors sm:min-h-[5.5rem] sm:p-2",
                        !inMonth && "bg-stone-50 text-stone-300",
                        inMonth && !isBlocked && !inRange && "bg-white hover:bg-stone-50",
                        inMonth && isBlocked && !inRange && "bg-stone-100",
                        inRange && "bg-bonnet/15",
                        isRangeEdge && "ring-2 ring-inset ring-bonnet",
                        isPast && inMonth && "opacity-55",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full text-sm font-medium",
                          isToday && "bg-bonnet text-white",
                          !isToday && isWeekend && inMonth && "text-stone-900",
                          !inMonth && "text-stone-300",
                        )}
                      >
                        {date.getDate()}
                      </span>
                      {inMonth ? (
                        isBlocked ? (
                          <span className="mt-auto text-[11px] font-medium text-stone-400">
                            Blocked
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "mt-auto text-[12px] font-semibold tabular-nums text-stone-900 sm:text-[13px]",
                            )}
                          >
                            {formatMoney(price)}
                          </span>
                        )
                      ) : null}
                    </button>
                  );
                })}
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
              setTab("blocks");
            }}
          />

          <PricingSidebar
            key={pricingKey}
            property={property}
            seasons={seasons}
            onOpenPeaks={() => setTab("peaks")}
          />
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
