/**
 * T49: Type choices for "Block or log a stay" (Calendar sheet and the full
 * Blocks form). Display labels only; the stored enum values are unchanged.
 *
 * OFFLINE is a guest stay booked off the site (phone, text, cash). It is a
 * direct booking (see DIRECT_BOOKING_BLOCK_TYPES), so it is the default and
 * is shown as "Guest booking (offline)".
 */
export const DEFAULT_BLOCK_TYPE = "OFFLINE" as const;

export const BLOCK_TYPE_OPTIONS = [
  { value: "OFFLINE", label: "Guest booking (offline)" },
  { value: "OWNER", label: "Owner use" },
  { value: "FRIENDS", label: "Friends & family" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "OTHER", label: "Other" },
] as const;

/**
 * Type to show after a render of the sheet: back to the default whenever the
 * sheet opens (or opens for a new range); otherwise keep the user's pick.
 */
export function blockTypeForSheet(
  lastSheetKey: string,
  sheetKey: string,
  open: boolean,
  current: string,
): string {
  if (open && sheetKey !== lastSheetKey) return DEFAULT_BLOCK_TYPE;
  return current;
}
