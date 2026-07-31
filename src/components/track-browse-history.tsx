"use client";

import { useEffect } from "react";
import {
  pushRecentSearch,
  pushRecentView,
} from "@/lib/browse-history-storage";
import type { RecentSearch, RecentView } from "@/lib/browse-history";

/** Persist a marketplace search when the guest lands on results. */
export function TrackRecentSearch(
  props: Omit<RecentSearch, "searchedAt"> & { resultCount?: number },
) {
  useEffect(() => {
    pushRecentSearch({
      where: props.where,
      checkIn: props.checkIn,
      checkOut: props.checkOut,
      guests: props.guests,
      pets: props.pets,
      resultCount: props.resultCount,
    });
  }, [
    props.where,
    props.checkIn,
    props.checkOut,
    props.guests,
    props.pets,
    props.resultCount,
  ]);

  return null;
}

/** Persist a listing view when the guest opens a property page. */
export function TrackRecentlyViewed(
  props: Omit<RecentView, "viewedAt">,
) {
  useEffect(() => {
    pushRecentView(props);
  }, [
    props.id,
    props.slug,
    props.hostSlug,
    props.title,
    props.city,
    props.region,
    props.baseNightlyRate,
    props.bedrooms,
    props.maxGuests,
    props.imageUrl,
  ]);

  return null;
}
