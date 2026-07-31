"use client";

import {
  MAX_SAVED_LISTINGS,
  SAVED_LISTINGS_KEY,
  type SavedListing,
} from "@/lib/saved-listings";

function safeParse(raw: string | null): SavedListing[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as SavedListing[];
    if (!Array.isArray(data)) return [];
    return data.filter((v) => v && typeof v.id === "string" && v.slug);
  } catch {
    return [];
  }
}

export function readSavedListings(): SavedListing[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(SAVED_LISTINGS_KEY));
}

export function isListingSaved(id: string): boolean {
  return readSavedListings().some((s) => s.id === id);
}

export function toggleSavedListing(
  listing: Omit<SavedListing, "savedAt">,
): boolean {
  if (typeof window === "undefined") return false;
  const prev = readSavedListings();
  const exists = prev.some((s) => s.id === listing.id);
  const next = exists
    ? prev.filter((s) => s.id !== listing.id)
    : [{ ...listing, savedAt: Date.now() }, ...prev].slice(
        0,
        MAX_SAVED_LISTINGS,
      );
  localStorage.setItem(SAVED_LISTINGS_KEY, JSON.stringify(next));
  // Notify other hearts / wishlist UI on this page
  window.dispatchEvent(new CustomEvent("staylocal:saved-listings"));
  return !exists;
}

export function subscribeSavedListings(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVED_LISTINGS_KEY || e.key === null) cb();
  };
  const onCustom = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener("staylocal:saved-listings", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("staylocal:saved-listings", onCustom);
  };
}
