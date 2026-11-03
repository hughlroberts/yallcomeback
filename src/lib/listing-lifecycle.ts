/** Shared, client-safe helpers for listing pause / archive / delete. */

/** Bookings that still hold dates: guests are paying or the stay is confirmed. */
export const ACTIVE_BOOKING_STATUSES = ["CONFIRMED", "PENDING_PAYMENT"] as const;

/** Typed confirmation for delete: same name, ignoring case and outer spaces. */
export function deleteConfirmMatches(title: string, typed: string): boolean {
  const a = title.trim().replace(/\s+/g, " ").toLowerCase();
  const b = typed.trim().replace(/\s+/g, " ").toLowerCase();
  return a.length > 0 && a === b;
}

export type ListingLifecycleState = "active" | "paused" | "archived";

export function listingLifecycleState(p: {
  published: boolean;
  archivedAt: Date | string | null;
}): ListingLifecycleState {
  if (p.archivedAt) return "archived";
  return p.published ? "active" : "paused";
}
