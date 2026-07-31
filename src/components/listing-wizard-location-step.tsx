"use client";

import { useMemo, useState, useTransition } from "react";
import {
  geocodeListingAddress,
  saveListingLocation,
} from "@/app/actions/properties";

type Props = {
  propertyId: string;
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

/** Host wizard always centers on the true pin; wider bbox previews guest “area” view. */
function mapEmbedUrl(lat: number, lng: number, precise: boolean) {
  const delta = precise ? 0.008 : 0.04;
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta * 0.7;
  const bottom = lat - delta * 0.7;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function ListingWizardLocationStep({ propertyId, initial }: Props) {
  const [phase, setPhase] = useState<Phase>("pin");
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [region, setRegion] = useState(initial.region);
  const [country, setCountry] = useState(initial.country || "USA");
  const [postalCode, setPostalCode] = useState(initial.postalCode);
  const [lat, setLat] = useState<number | null>(initial.latitude);
  const [lng, setLng] = useState<number | null>(initial.longitude);
  const [showPrecise, setShowPrecise] = useState(initial.showPreciseLocation);
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [pending, startTransition] = useTransition();

  const queryLine = useMemo(() => {
    return [address, city, region, postalCode, country]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  }, [address, city, region, postalCode, country]);

  async function findOnMap() {
    setError(null);
    if (!queryLine) {
      setError("Enter an address to place the pin");
      return;
    }
    setFinding(true);
    try {
      const result = await geocodeListingAddress(queryLine);
      if (!result) {
        setError("Couldn’t find that address - try adding city and state");
        return;
      }
      setLat(result.lat);
      setLng(result.lng);
      if (result.city && !city) setCity(result.city);
      if (result.region && !region) setRegion(result.region);
      if (result.postalCode && !postalCode) setPostalCode(result.postalCode);
      if (result.country && country === "USA" && result.country !== "USA") {
        setCountry(result.country);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setFinding(false);
    }
  }

  function nudge(dLat: number, dLng: number) {
    if (lat == null || lng == null) return;
    setLat(Number((lat + dLat).toFixed(6)));
    setLng(Number((lng + dLng).toFixed(6)));
  }

  function onNextFromPin() {
    setError(null);
    if (!address.trim() && !city.trim()) {
      setError("Add at least a street or city");
      return;
    }
    if (lat == null || lng == null) {
      setError("Find the address on the map first");
      return;
    }
    setPhase("visibility");
  }

  function onSave() {
    setError(null);
    if (lat == null || lng == null) {
      setError("Map pin is required");
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
        fd.set("latitude", String(lat));
        fd.set("longitude", String(lng));
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
        <a
          href="/admin/properties"
          className="rounded-full border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
        >
          Save & exit
        </a>
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
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address"
                className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="rounded-xl border border-stone-300 px-4 py-3 text-sm"
                />
                <input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="State / region"
                  className="rounded-xl border border-stone-300 px-4 py-3 text-sm"
                />
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="ZIP / postal"
                  className="rounded-xl border border-stone-300 px-4 py-3 text-sm"
                />
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
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
                <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-stone-500 sm:h-80">
                  Enter an address and tap Find on map to place the pin.
                </div>
              )}
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
              ) : null}
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
                  onClick={() => setShowPrecise((v) => !v)}
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
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => {
              if (phase === "visibility") setPhase("pin");
              else window.location.href = `/admin/properties/${propertyId}/setup?step=2`;
            }}
            className="text-sm font-semibold text-stone-800 underline-offset-2 hover:underline"
          >
            Back
          </button>
          <button
            type="button"
            onClick={phase === "pin" ? onNextFromPin : onSave}
            disabled={pending}
            className="rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-medium text-white hover:bg-bonnet-hover disabled:cursor-not-allowed disabled:bg-lupine/40"
          >
            {pending ? "Saving…" : "Next"}
          </button>
        </div>
      </footer>
    </div>
  );
}
