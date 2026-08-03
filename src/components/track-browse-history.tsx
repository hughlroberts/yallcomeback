"use client";

import { useEffect } from "react";
import {
  pushRecentSearch,
  pushRecentView,
} from "@/lib/browse-history-storage";
import type { RecentSearch, RecentView } from "@/lib/browse-history";

/** Persist a marketplace search when the guest lands on results. */
export function TrackRecentSearch({
  where,
  checkIn,
  checkOut,
  guests,
  pets,
  resultCount,
}: Omit<RecentSearch, "searchedAt"> & { resultCount?: number }) {
  useEffect(() => {
    pushRecentSearch({
      where,
      checkIn,
      checkOut,
      guests,
      pets,
      resultCount,
    });
  }, [where, checkIn, checkOut, guests, pets, resultCount]);

  return null;
}

/** Persist a listing view when the guest opens a property page. */
export function TrackRecentlyViewed({
  id,
  slug,
  hostSlug,
  title,
  city,
  region,
  baseNightlyRate,
  bedrooms,
  maxGuests,
  imageUrl,
}: Omit<RecentView, "viewedAt">) {
  useEffect(() => {
    pushRecentView({
      id,
      slug,
      hostSlug,
      title,
      city,
      region,
      baseNightlyRate,
      bedrooms,
      maxGuests,
      imageUrl,
    });
  }, [
    id,
    slug,
    hostSlug,
    title,
    city,
    region,
    baseNightlyRate,
    bedrooms,
    maxGuests,
    imageUrl,
  ]);

  return null;
}
