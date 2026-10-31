/**
 * Tiny client-side store so the mobile bottom booking bar mirrors the
 * booking widget's live state (dates, total) without prop drilling.
 * The widget publishes; MobileReserveBar subscribes (useSyncExternalStore).
 */

export type BookingBarState = {
  checkIn: string;
  checkOut: string;
  nights: number | null;
  total: number | null;
  error: string | null;
};

const EMPTY: BookingBarState = {
  checkIn: "",
  checkOut: "",
  nights: null,
  total: null,
  error: null,
};

let state: BookingBarState = EMPTY;
let bookAction: (() => void) | null = null;
const listeners = new Set<() => void>();

export function publishBookingBarState(next: BookingBarState): void {
  if (
    next.checkIn === state.checkIn &&
    next.checkOut === state.checkOut &&
    next.nights === state.nights &&
    next.total === state.total &&
    next.error === state.error
  ) {
    return;
  }
  state = next;
  listeners.forEach((l) => l());
}

export function resetBookingBarState(): void {
  bookAction = null;
  publishBookingBarState(EMPTY);
}

export function subscribeBookingBar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBookingBarState(): BookingBarState {
  return state;
}

export function getServerBookingBarState(): BookingBarState {
  return EMPTY;
}

/** Widget registers its "book" handler so the bar can start the same flow. */
export function setBookingBarAction(action: (() => void) | null): void {
  bookAction = action;
}

export function runBookingBarAction(): boolean {
  if (!bookAction) return false;
  bookAction();
  return true;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortDate(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  return `${month} ${Number(m[3])}`;
}

/** "Nov 3 – Nov 6" for the bar, or null when dates aren't both set. */
export function bookingBarDateLabel(checkIn: string, checkOut: string): string | null {
  if (!checkIn || !checkOut) return null;
  const a = shortDate(checkIn);
  const b = shortDate(checkOut);
  if (!a || !b) return null;
  return `${a} – ${b}`;
}

/** Bar CTA label: same flag as the quote box. */
export function bookingBarCta(depositDueNow: boolean): string {
  return depositDueNow ? "Reserve" : "Request to book";
}
