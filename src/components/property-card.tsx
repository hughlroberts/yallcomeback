import Link from "next/link";
import Image from "next/image";
import { formatMoney } from "@/lib/utils";
import { SaveListingButton } from "@/components/save-listing-button";

type Props = {
  property: {
    id?: string;
    slug: string;
    title: string;
    tagline?: string | null;
    city: string | null;
    region: string | null;
    baseNightlyRate: number;
    maxGuests: number;
    bedrooms: number;
    bathrooms?: number;
    images: { url: string; alt: string | null }[];
    host?: { name: string; slug: string } | null;
  };
  href?: string;
  currencySymbol?: string;
  showHost?: boolean;
  /** e.g. "3.2 mi away" from map distance sort (miles) */
  distanceLabel?: string | null;
  /** Show heart overlay (default true when id + host slug available) */
  showSave?: boolean;
};

export function PropertyCard({
  property,
  href,
  currencySymbol = "$",
  showHost = false,
  distanceLabel,
  showSave,
}: Props) {
  const cover = property.images[0];
  const location = [property.city, property.region].filter(Boolean).join(", ");
  const link =
    href ||
    (property.host
      ? `/marketplace/properties/${property.slug}?host=${property.host.slug}`
      : `/marketplace/properties/${property.slug}`);

  const canSave =
    showSave !== false &&
    Boolean(property.id && property.host?.slug);

  return (
    <div className="group relative">
      <Link href={link} className="block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-200 shadow-sm ring-1 ring-black/5">
          {cover ? (
            <Image
              src={cover.url}
              alt={cover.alt || property.title}
              fill
              className="object-cover transition duration-500 group-hover:scale-[1.04]"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-400">
              No photo
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-80" />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
            <p className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-stone-900 shadow-sm">
              {formatMoney(property.baseNightlyRate, currencySymbol)}
              <span className="font-normal text-stone-500"> / night</span>
            </p>
            {distanceLabel ? (
              <p className="rounded-full bg-bonnet/85 px-2.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-sm">
                {distanceLabel}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-3.5 space-y-1">
          {showHost && property.host ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-bonnet">
              {property.host.name}
            </p>
          ) : null}
          <h3 className="text-lg font-semibold leading-snug text-stone-900 group-hover:underline decoration-stone-300 underline-offset-2">
            {property.title}
          </h3>
          {property.tagline ? (
            <p className="line-clamp-2 text-sm text-stone-600">
              {property.tagline}
            </p>
          ) : null}
          {location ? (
            <p className="text-sm text-stone-500">{location}</p>
          ) : null}
          <p className="text-sm text-stone-500">
            {property.bedrooms} bed
            {property.bathrooms != null ? ` · ${property.bathrooms} bath` : ""}
            {" · "}
            {property.maxGuests} guests
          </p>
        </div>
      </Link>
      {canSave && property.id && property.host ? (
        <div className="absolute right-2.5 top-2.5 z-10">
          <SaveListingButton
            variant="icon"
            listing={{
              id: property.id,
              slug: property.slug,
              hostSlug: property.host.slug,
              title: property.title,
              city: property.city,
              region: property.region,
              baseNightlyRate: property.baseNightlyRate,
              bedrooms: property.bedrooms,
              maxGuests: property.maxGuests,
              imageUrl: cover?.url ?? null,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
