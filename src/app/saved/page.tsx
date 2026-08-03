"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useSyncExternalStore } from "react";
import { formatMoney } from "@/lib/utils";
import { listingHref, type SavedListing } from "@/lib/saved-listings";
import {
  readSavedListings,
  subscribeSavedListings,
  toggleSavedListing,
} from "@/lib/saved-listings-storage";

const emptySaved: SavedListing[] = [];

export default function SavedStaysPage() {
  const items = useSyncExternalStore(
    subscribeSavedListings,
    readSavedListings,
    () => emptySaved,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            Saved stays
          </h1>
          <p className="mt-2 text-stone-500">
            Places you hearted while browsing. Saved on this device.
          </p>
        </div>
        <Link
          href="/marketplace"
          className="text-sm font-semibold text-bonnet hover:underline"
        >
          Browse stays →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-16 rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-6 py-16 text-center">
          <Heart className="mx-auto size-10 text-stone-300" strokeWidth={1.5} />
          <p className="mt-4 font-medium text-stone-700">No saved stays yet</p>
          <p className="mt-2 text-sm text-stone-500">
            Tap the heart on any listing to save it here.
          </p>
          <Link
            href="/marketplace"
            className="mt-6 inline-flex rounded-[var(--radius-control)] bg-bonnet px-5 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover"
          >
            Explore stays
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const location = [item.city, item.region]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={item.id} className="group relative">
                <Link href={listingHref(item)} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-200 ring-1 ring-black/5">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-[1.03]"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-stone-400">
                        No photo
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3">
                      <p className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-stone-900 shadow-sm">
                        {formatMoney(item.baseNightlyRate)}
                        <span className="font-normal text-stone-500">
                          {" "}
                          / night
                        </span>
                      </p>
                    </div>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-stone-900 group-hover:underline">
                    {item.title}
                  </h2>
                  {location ? (
                    <p className="text-sm text-stone-500">{location}</p>
                  ) : null}
                  <p className="text-sm text-stone-500">
                    {item.bedrooms} bed · {item.maxGuests} guests
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    toggleSavedListing(item);
                  }}
                  className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/95 text-blue-500 shadow-sm ring-1 ring-black/5 hover:bg-white"
                  aria-label="Remove from saved"
                >
                  <Heart className="size-[18px] fill-blue-500" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
