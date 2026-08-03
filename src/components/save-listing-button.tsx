"use client";

import { Heart } from "lucide-react";
import { useSyncExternalStore, type MouseEvent } from "react";
import type { SavedListing } from "@/lib/saved-listings";
import {
  isListingSaved,
  subscribeSavedListings,
  toggleSavedListing,
} from "@/lib/saved-listings-storage";

type ListingInput = Omit<SavedListing, "savedAt">;

type Props = {
  listing: ListingInput;
  /** text = Airbnb-style “Save” next to title; icon = card overlay heart */
  variant?: "text" | "icon";
  className?: string;
};

/**
 * Heart / unheart a stay. Stored in the browser so guests don’t need an account.
 */
export function SaveListingButton({
  listing,
  variant = "text",
  className = "",
}: Props) {
  const saved = useSyncExternalStore(
    subscribeSavedListings,
    () => isListingSaved(listing.id),
    () => false,
  );

  function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleSavedListing(listing);
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={saved ? "Remove from saved" : "Save this stay"}
        aria-pressed={saved}
        className={`flex size-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition hover:bg-black/40 hover:scale-105 ${className}`}
      >
        <Heart
          className={`size-[18px] drop-shadow-sm ${
            saved ? "fill-blue-500 text-blue-500" : "fill-black/20"
          }`}
          strokeWidth={2}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={saved ? "Remove from saved" : "Save this stay"}
      aria-pressed={saved}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-700 underline-offset-2 transition hover:bg-stone-100 hover:underline ${className}`}
    >
      <Heart
        className={`size-4 ${
          saved ? "fill-blue-500 text-blue-500" : "text-stone-700"
        }`}
        strokeWidth={1.75}
      />
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
