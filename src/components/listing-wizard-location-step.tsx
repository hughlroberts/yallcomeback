"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  geocodeListingAddress,
  saveListingLocation,
} from "@/app/actions/properties";
import { WizardMissingFields } from "@/components/wizard-missing-fields";
import { useListingWizardAutosave } from "@/lib/use-listing-wizard-autosave";

type Props = {
  propertyId: string;
  serverUpdatedAt?: string | Date | null;
  initial: {
    address: string;
    city: string;
    region: string;
    country: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
    showPreciseLocation: boolean;
  };
};

type Phase = "pin" | "visibility";

type LocationFields = {
  address: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  showPrecise: boolean;
};

/** Host wizard always centers on the true pin; wider bbox previews guest “area” view. */
function mapEmbedUrl(lat: number, lng: number, precise: boolean) {
  const delta = precise ? 0.008 : 0.04;
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta * 0.7;
  const bottom = lat - delta * 0.7;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function geocodeMissMessage(city: string, region: string): string {
  const needCity = !city.trim();
  const needRegion = !region.trim();
  if (needCity && needRegion) {
    return "Couldn’t find that address — try adding city and state, place a pin manually, or continue anyway.";
  }
  if (needCity) {
    return "Couldn’t find that address — try adding a city, place a pin manually, or continue anyway.";
  }
  if (needRegion) {
    return "Couldn’t find that address — try adding a state/region, place a pin manually, or continue anyway.";
  }
  return "Couldn’t find that address on the map. Place a pin manually or continue with the address as entered.";
}

export function ListingWizardLocationStep({
  propertyId,
  serverUpdatedAt,
  initial,
}: Props) {
  const draftKey = `property-${propertyId}`;
  const { values, setValues } = useListingWizardAutosave<LocationFields>({
    draftKey,
    step: "location",
    serverUpdatedAt,
    initial: {
      address: initial.address,
      city: initial.city,
      region: initial.region,
      country: initial.country || "USA",
      postalCode: initial.postalCode,
      lat: initial.latitude,
      lng: initial.longitude,
      showPrecise: initial.showPreciseLocation,
    },
  });

  const { address, city, region, country, postalCode, lat, lng, showPrecise } =
    values;

  const [phase, setPhase] = useState<Phase>("pin");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [latInput, setLatInput] = useState(
    initial.latitude != null ? String(initial.latitude) : "",
  );
  const [lngInput, setLngInput] = useState(
    initial.longitude != null ? String(initial.longitude) : "",
  );

  // Keep manual coord fields in sync when draft restore / nudge updates lat/lng.
  useEffect(() => {
    setLatInput(lat != null ? String(lat) : "");
    setLngInput(lng != null ? String(lng) : "");
  }, [lat, lng]);

  const queryLine = useMemo(() => {
    return [address, city, region, postalCode, country]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  }, [address, city, region, postalCode, country]);

  const missing: string[] = [];
  if (phase === "pin" && !address.trim() && !city.trim()) {
    missing.push("Street address or city");
  }
  const nextDisabled = pending || missing.length > 0;

  function patch(partial: Partial<LocationFields>) {
    setValues((prev) => ({ ...prev, ...partial }));
  }

  async function findOnMap() {
    setError(null);
    setWarning(null);
    if (!queryLine) {
      setError("Enter an address to place the pin");
      return;
    }
    setFinding(true);
    try {
      const result = await geocodeListingAddress(queryLine);
      if (!result) {
        setWarning(geocodeMissMessage(city, region));
        return;
      }
      patch({
        lat: result.lat,
        lng: result.lng,
        city: result.city && !city ? result.city : city,
        region: result.region && !region ? result.region : region,
        postalCode:
          result.postalCode && !postalCode ? result.postalCode : postalCode,
        country:
          result.country && country === "USA" && result.country !== "USA"
            ? result.country
            : country,
      });
      setLatInput(String(result.lat));
      setLngInput(String(result.lng));
      setWarning(null);
    } catch (e) {
      setWarning(
        e instanceof Error
          ? `${e.message} You can place a pin manually or continue anyway.`
          : "Lookup failed. Place a pin manually or continue anyway.",
      );
    } finally {
      setFinding(false);
    }
  }

  function applyManualCoords() {
    setError(null);
    const la = Number(latInput);
    const ln = Number(lngInput);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) {
      setError("Enter numeric latitude and longitude");
      return;
    }
    if (la < -90 || la > 90 || ln < -180 || ln > 180) {
      setError("Latitude must be −90…90 and longitude −180…180");
      return;
    }
    patch({
      lat: Number(la.toFixed(6)),
      lng: Number(ln.toFixed(6)),
    });
    setLatInput(la.toFixed(6));
    setLngInput(ln.toFixed(6));
    setWarning(null);
  }

  function nudge(dLat: number, dLng: number) {
    if (lat == null || lng == null) return;
    const nextLat = Number((lat + dLat).toFixed(6));
    const nextLng = Number((lng + dLng).toFixed(6));
    patch({ lat: nextLat, lng: nextLng });
    setLatInput(String(nextLat));
    setLngInput(String(nextLng));
  }

  function onNextFromPin() {
    setError(null);
    if (!address.trim() && !city.trim()) {
      setError("Add at least a street or city");
      return;
    }
    if (lat == null || lng == null) {
      // Soft warning only — still allow continuing with the typed address.
      setWarning(
        warning ||
          "No map pin yet. Guests will see the address text only until you add coordinates. You can place a pin manually below, or continue anyway.",
      );
    }
    setPhase("visibility");
  }

  function onSave() {
    setError(null);
    if (!address.trim() && !city.trim()) {
      setError("Add at least a street or city");
      setPhase("pin");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", propertyId);
        fd.set("address", address);
        fd.set("city", city);
        fd.set("region", region);
        fd.set("country", country);
        fd.set("postalCode", postalCode);
        if (lat != null && lng != null) {
          fd.set("latitude", String(lat));
          fd.set("longitude", String(lng));
        }
        if (showPrecise) fd.set("showPreciseLocation", "on");
        await saveListingLocation(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const mapUrl =
    lat != null && lng != null
      ? mapEmbedUrl(lat, lng, phase === "visibility" ? showPrecise : true)
      : null;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-white">
      <header className="flex items-center justify-between border-b border-stone-200 px-4 py-4 sm:px-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bonnet text-sm font-bold text-white">
          S
        </span>
        <Link
          href="/admin/properties"
          className="rounded-full border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
        >
          Save & exit
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {phase === "pin" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              Is the pin in the right spot?
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Your address is only shared with guests after they book.
            </p>

            <div className="mt-6 space-y-3">
              <input
                value={address}
                onChange={(e) => patch({ address: e.target.value })}
                placeholder="Street address"
                className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={city}
                  onChange={(e) => patch({ city: e.target.value })}
                  placeholder="City"
                  className="rounded-xl border border-stone-300 px-4 py-3 text-sm"
                />
                <input
                  value={region}
                  onChange={(e) => patch({ region: e.target.value })}
                  placeholder="State / region"
                  className="rounded-xl border border-stone-300 px-4 py-3 text-sm"
                />
                <input
                  value={postalCode}
                  onChange={(e) => patch({ postalCode: e.target.value })}
                  placeholder="ZIP / postal"
                  className="rounded-xl border border-stone-300 px-4 py-3 text-sm"
                />
                <input
                  value={country}
                  onChange={(e) => patch({ country: e.target.value })}
                  placeholder="Country"
                  className="rounded-xl border border-stone-300 px-4 py-3 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={findOnMap}
                disabled={finding}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50"
              >
                {finding ? "Finding…" : "Find on map"}
              </button>
            </div>

            <div className="relative mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
              {mapUrl ? (
                <>
                  <iframe
                    title="Listing map"
                    src={mapUrl}
                    className="h-72 w-full border-0 sm:h-80"
                    loading="lazy"
                  />
                  <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
                    <span className="rounded-full bg-bonnet px-4 py-2 text-xs font-medium text-white shadow-lg">
                      Nudge the pin if needed
                    </span>
                    <div className="flex gap-1 rounded-full bg-white p-1 shadow-md">
                      <button
                        type="button"
                        onClick={() => nudge(0.0003, 0)}
                        className="rounded-full px-3 py-1 text-xs font-semibold hover:bg-stone-100"
                        aria-label="Move north"
                      >
                        N
                      </button>
                      <button
                        type="button"
                        onClick={() => nudge(-0.0003, 0)}
                        className="rounded-full px-3 py-1 text-xs font-semibold hover:bg-stone-100"
                        aria-label="Move south"
                      >
                        S
                      </button>
                      <button
                        type="button"
                        onClick={() => nudge(0, -0.0003)}
                        className="rounded-full px-3 py-1 text-xs font-semibold hover:bg-stone-100"
                        aria-label="Move west"
                      >
                        W
                      </button>
                      <button
                        type="button"
                        onClick={() => nudge(0, 0.0003)}
                        className="rounded-full px-3 py-1 text-xs font-semibold hover:bg-stone-100"
                        aria-label="Move east"
                      >
                        E
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-72 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-stone-500 sm:h-80">
                  <p>
                    Enter an address and tap Find on map, or set coordinates
                    manually below.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-semibold text-stone-900">
                Place pin manually
              </p>
              <p className="mt-1 text-xs text-stone-500">
                If lookup can&apos;t find the address, enter latitude and
                longitude, then apply.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-600">
                  Latitude
                  <input
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                    placeholder="e.g. 32.7767"
                    inputMode="decimal"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-stone-600">
                  Longitude
                  <input
                    value={lngInput}
                    onChange={(e) => setLngInput(e.target.value)}
                    placeholder="e.g. -96.7970"
                    inputMode="decimal"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={applyManualCoords}
                className="mt-3 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100"
              >
                Apply coordinates
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              Choose how guests see your location on a map
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              We only share your full address after guests book. Until then,
              they&apos;ll see an approximate location.
            </p>

            <div className="relative mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
              {queryLine ? (
                <div className="absolute left-3 right-3 top-3 z-10 flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm shadow-sm">
                  <span aria-hidden>📍</span>
                  <span className="truncate font-medium text-stone-800">
                    {queryLine}
                  </span>
                </div>
              ) : null}
              {mapUrl ? (
                <iframe
                  title="Guest map preview"
                  src={mapUrl}
                  className="h-72 w-full border-0 sm:h-80"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-stone-500 sm:h-80">
                  No map pin yet — guests will still see the address text you
                  entered. You can add coordinates later in the editor.
                </div>
              )}
              <div className="flex items-center justify-between gap-4 border-t border-stone-200 bg-white px-5 py-4">
                <div className="min-w-0">
                  <div className="font-semibold text-stone-900">
                    Show precise location
                  </div>
                  <p className="mt-0.5 text-sm text-stone-500">
                    Let guests see your home&apos;s exact spot on the map before
                    they book.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showPrecise}
                  onClick={() => patch({ showPrecise: !showPrecise })}
                  className={[
                    "relative h-8 w-14 shrink-0 rounded-full transition",
                    showPrecise ? "bg-bonnet" : "bg-stone-300",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition",
                      showPrecise ? "left-7" : "left-1",
                    ].join(" ")}
                  />
                </button>
              </div>
            </div>
          </>
        )}

        {warning ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p>{warning}</p>
            {phase === "pin" && (lat == null || lng == null) ? (
              <button
                type="button"
                onClick={() => {
                  setWarning(null);
                  setPhase("visibility");
                }}
                className="mt-3 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100"
              >
                Continue anyway
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-stone-200 bg-white">
        <div className="h-1 bg-stone-100">
          <div
            className={[
              "h-full bg-bonnet transition-all",
              phase === "pin" ? "w-[36%]" : "w-[48%]",
            ].join(" ")}
          />
        </div>
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-4 sm:px-6">
          {nextDisabled && missing.length > 0 ? (
            <WizardMissingFields missing={missing} />
          ) : null}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (phase === "visibility") setPhase("pin");
                else
                  window.location.href = `/admin/properties/${propertyId}/setup?step=2`;
              }}
              className="text-sm font-semibold text-stone-800 underline-offset-2 hover:underline"
            >
              Back
            </button>
            <button
              type="button"
              onClick={phase === "pin" ? onNextFromPin : onSave}
              disabled={nextDisabled}
              className="rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-medium text-white hover:bg-bonnet-hover disabled:cursor-not-allowed disabled:bg-lupine/40"
            >
              {pending ? "Saving…" : "Next"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
