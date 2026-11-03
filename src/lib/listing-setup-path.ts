/** True on listing wizard pages: /admin/properties/<id>/setup (any step). */
export function isListingSetupPath(pathname: string | null | undefined): boolean {
  return /^\/admin\/properties\/[^/]+\/setup\/?$/.test((pathname || "").split("?")[0]!);
}

/** Where the header logo goes during listing setup (same place as Save & exit). */
export const LISTING_SETUP_EXIT_HREF = "/admin/properties";
export const LISTING_SETUP_EXIT_LABEL = "Exit setup";
