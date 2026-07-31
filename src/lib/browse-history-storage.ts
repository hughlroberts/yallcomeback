"use client";

import {
  MAX_RECENT_SEARCHES,
  MAX_RECENT_VIEWS,
  RECENT_SEARCHES_KEY,
  RECENT_VIEWS_KEY,
  searchDedupeKey,
  searchIsMeaningful,
  type RecentSearch,
  type RecentView,
} from "@/lib/browse-history";

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readRecentViews(): RecentView[] {
  if (typeof window === "undefined") return [];
  const data = safeParseJson<RecentView[]>(
    localStorage.getItem(RECENT_VIEWS_KEY),
  );
  if (!Array.isArray(data)) return [];
  return data.filter((v) => v && typeof v.id === "string" && v.slug);
}

export function readRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  const data = safeParseJson<RecentSearch[]>(
    localStorage.getItem(RECENT_SEARCHES_KEY),
  );
  if (!Array.isArray(data)) return [];
  return data.filter((s) => s && searchIsMeaningful(s));
}

export function pushRecentView(view: Omit<RecentView, "viewedAt">) {
  if (typeof window === "undefined") return;
  const next: RecentView = { ...view, viewedAt: Date.now() };
  const prev = readRecentViews().filter((v) => v.id !== next.id);
  const merged = [next, ...prev].slice(0, MAX_RECENT_VIEWS);
  localStorage.setItem(RECENT_VIEWS_KEY, JSON.stringify(merged));
}

export function pushRecentSearch(
  search: Omit<RecentSearch, "searchedAt"> & { searchedAt?: number },
) {
  if (typeof window === "undefined") return;
  if (!searchIsMeaningful(search)) return;
  const next: RecentSearch = {
    where: search.where?.trim() || undefined,
    checkIn: search.checkIn || undefined,
    checkOut: search.checkOut || undefined,
    guests: search.guests && search.guests > 0 ? search.guests : undefined,
    pets: search.pets && search.pets > 0 ? search.pets : undefined,
    resultCount: search.resultCount,
    searchedAt: search.searchedAt ?? Date.now(),
  };
  const key = searchDedupeKey(next);
  const prev = readRecentSearches().filter((s) => searchDedupeKey(s) !== key);
  const merged = [next, ...prev].slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(merged));
}
