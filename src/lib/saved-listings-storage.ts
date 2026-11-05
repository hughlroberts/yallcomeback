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

/** Stable empty snapshot for SSR / first client read with nothing saved. */
const EMPTY: SavedListing[] = [];

/**
 * Cache the last parsed list so useSyncExternalStore getSnapshot returns the
 * same reference when localStorage has not changed (React 185 otherwise).
 */
let cachedRaw: string | null | undefined = undefined;
let cachedList: SavedListing[] = EMPTY;

function syncCacheFromStorage(): SavedListing[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(SAVED_LISTINGS_KEY);
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  const next = safeParse(raw);
  cachedList = next.length === 0 ? EMPTY : next;
  return cachedList;
}

function writeCache(next: SavedListing[]) {
  const raw = JSON.stringify(next);
  localStorage.setItem(SAVED_LISTINGS_KEY, raw);
  cachedRaw = raw;
  cachedList = next.length === 0 ? EMPTY : next;
}

/** @internal test helper — clear module cache between cases */
export function __resetSavedListingsCacheForTests() {
  cachedRaw = undefined;
  cachedList = EMPTY;
}

export function readSavedListings(): SavedListing[] {
  return syncCacheFromStorage();
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
  writeCache(next);
  // Notify other hearts / wishlist UI on this page
  window.dispatchEvent(new CustomEvent("staylocal:saved-listings"));
  return !exists;
}

export function subscribeSavedListings(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVED_LISTINGS_KEY || e.key === null) {
      // Drop cache so the next getSnapshot re-reads (other tab may have written).
      cachedRaw = undefined;
      cb();
    }
  };
  const onCustom = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener("staylocal:saved-listings", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("staylocal:saved-listings", onCustom);
  };
}
