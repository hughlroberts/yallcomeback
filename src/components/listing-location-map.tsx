import { Home } from "lucide-react";
import {
  formatListingPlaceLine,
  listingMapEmbedUrl,
  listingMapExternalUrl,
  publicMapPoint,
} from "@/lib/listing-map";

type Props = {
  latitude: number | null;
  longitude: number | null;
  showPreciseLocation: boolean;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  /** Optional area name under the pin (e.g. neighborhood or host brand) */
  areaLabel?: string | null;
  className?: string;
};

/**
 * Airbnb-style “Where you'll be” block - full-width map toward the bottom
 * of a listing, house pin, place line, exact-location disclaimer.
 */
export function ListingLocationMap({
  latitude,
  longitude,
  showPreciseLocation,
  city,
  region,
  country,
  areaLabel,
  className = "",
}: Props) {
  const placeLine = formatListingPlaceLine({ city, region, country });
  const point = publicMapPoint(latitude, longitude, showPreciseLocation);

  // Nothing useful to show
  if (!point && !placeLine) return null;

  const embedUrl = point ? listingMapEmbedUrl(point) : null;
  const openUrl = point ? listingMapExternalUrl(point) : null;
  const pinLabel =
    areaLabel?.trim() ||
    city?.trim() ||
    region?.trim() ||
    null;

  return (
    <section className={className} aria-labelledby="where-youll-be-heading">
      <h2
        id="where-youll-be-heading"
        className="text-2xl font-semibold tracking-tight text-stone-900"
      >
        Where you&apos;ll be
      </h2>
      {placeLine ? (
        <p className="mt-1.5 text-base text-stone-500">{placeLine}</p>
      ) : null}

      {embedUrl && point ? (
        <div className="relative mt-6 overflow-hidden rounded-2xl bg-stone-100 shadow-sm ring-1 ring-stone-200/80">
          {/* Wide map like listing detail maps */}
          <div className="relative aspect-[16/10] w-full sm:aspect-[2/1]">
            <iframe
              title={
                placeLine
                  ? `Map of ${placeLine}`
                  : "Map of the stay location"
              }
              src={embedUrl}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />

            {/* Soft vignette so the pin reads clearly */}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.06] via-transparent to-black/[0.03]"
              aria-hidden
            />

            {/* Approximate area ring (when host hides exact pin) */}
            {!point.precise ? (
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[min(42%,220px)] w-[min(42%,220px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-600/15 ring-2 ring-cyan-700/25"
                aria-hidden
              />
            ) : null}

            {/* Center house pin - Airbnb-style black circle + home */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-[58%] flex-col items-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-bonnet text-white shadow-lg ring-2 ring-white">
                <Home className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </div>
              {pinLabel ? (
                <span className="mt-1.5 max-w-[10rem] truncate rounded-md bg-white/95 px-2 py-0.5 text-center text-xs font-semibold text-stone-900 shadow-sm ring-1 ring-black/5">
                  {pinLabel}
                </span>
              ) : null}
            </div>
          </div>

          {openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-3 z-[3] rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm ring-1 ring-black/10 backdrop-blur hover:bg-white"
            >
              Expand map
            </a>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 flex aspect-[2/1] items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 text-center text-sm text-stone-500">
          Map pin not set yet
          {placeLine ? (
            <span className="block w-full pt-1 text-stone-600">{placeLine}</span>
          ) : null}
        </div>
      )}

      <p className="mt-3 text-sm text-stone-500">
        {point && !point.precise
          ? "Exact location will be provided after booking."
          : point?.precise
            ? "The pin shows where the stay is. Full street address is shared after booking confirmation."
            : "Exact location will be provided after booking."}
      </p>
    </section>
  );
}
