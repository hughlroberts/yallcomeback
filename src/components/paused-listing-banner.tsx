import { PAUSED_PREVIEW_BANNER } from "@/lib/brand-visibility";
import { PRIVATE_PREVIEW_BANNER_NOTE } from "@/lib/private-preview-label";

/** T58: shown only to the brand's host/admin previewing a paused listing. */
export function PausedListingBanner() {
  return (
    <div
      data-testid="paused-listing-banner"
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      {PAUSED_PREVIEW_BANNER}. {PRIVATE_PREVIEW_BANNER_NOTE} Resume the
      listing in Admin to take bookings.
    </div>
  );
}
