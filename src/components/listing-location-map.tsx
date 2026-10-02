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
 * “Where you'll be” on a guest listing. Map only when a pin exists;
 * otherwise city/region plus the after-booking line — no empty canvas.
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
        className="text-xl font-semibold tracking-tight text-stone-900"
      >
        Where you&apos;ll be
      </h2>
      {placeLine ? (
        <p className="mt-1 text-sm text-stone-500">{placeLine}</p>
      ) : null}

      {embedUrl && point ? (
        <div className="relative mt-3 overflow-hidden rounded-xl bg-stone-100 shadow-sm ring-1 ring-stone-200/80">
          <div className="relative h-36 w-full sm:h-44">
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

            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.06] via-transparent to-black/[0.03]"
              aria-hidden
            />

            {!point.precise ? (
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-600/15 ring-2 ring-cyan-700/25"
                aria-hidden
              />
            ) : null}

            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-[58%] flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bonnet text-white shadow-md ring-2 ring-white">
                <Home className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              </div>
              {pinLabel ? (
                <span className="mt-1 max-w-[10rem] truncate rounded-md bg-white/95 px-1.5 py-0.5 text-center text-[11px] font-semibold text-stone-900 shadow-sm ring-1 ring-black/5">
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
              className="absolute bottom-2 right-2 z-[3] rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-stone-800 shadow-sm ring-1 ring-black/10 backdrop-blur hover:bg-white"
            >
              Expand map
            </a>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-sm text-stone-500">
        {point && !point.precise
          ? "Exact location will be provided after booking."
          : point?.precise
            ? "The pin shows where the stay is. Full street address is shared after booking confirmation."
            : "Exact location will be provided after booking."}
      </p>
    </section>
  );
}
