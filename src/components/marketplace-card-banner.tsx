import { HOSTING_BILLING_ROUTE } from "@/lib/branded-upgrade";
import { marketplacePriceWithCardLabel } from "@/lib/hosting-prices";
import type { MarketplaceCardState } from "@/lib/marketplace-billing-plan";

export function graceDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });
}

/**
 * T45: a Marketplace brand with no card subscription. During the 14-day
 * grace it asks for a card; after it, the listings are hidden from Find a
 * Place until the host pays. Plain form POST (same as the Branded banner).
 */
export function MarketplaceCardBanner({
  hostId,
  hostName,
  state,
  unitUsd,
}: {
  hostId: string;
  hostName: string;
  state: MarketplaceCardState;
  unitUsd?: number | null;
}) {
  if (state.kind === "ok" || state.kind === "grace_unset") return null;
  const price = marketplacePriceWithCardLabel(unitUsd);
  const suspended = state.kind === "suspended";
  return (
    <div
      role="status"
      data-testid="marketplace-card-banner"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        suspended
          ? "border-red-300 bg-red-50 text-red-950"
          : "border-amber-300 bg-amber-50 text-amber-950"
      }`}
    >
      {suspended ? (
        <p>
          <strong>Marketplace · Listings hidden.</strong> The 14 days to add a
          card ended. Guests cannot find {hostName} on Find a Place. Add a card
          to show your listings again. Your listings and bookings are not
          deleted.
        </p>
      ) : (
        <p>
          <strong>Marketplace · Add a card.</strong> Marketplace listings are
          now paid by card: {price}. Add a card by{" "}
          <strong>{graceDateLabel(state.endsAt)}</strong> ({state.daysLeft} day
          {state.daysLeft === 1 ? "" : "s"} left). If you do not, guests cannot
          find {hostName} on Find a Place until you pay.
        </p>
      )}
      <form method="post" action={HOSTING_BILLING_ROUTE}>
        <input type="hidden" name="intent" value="subscribe" />
        <input type="hidden" name="hostId" value={hostId} />
        <button
          type="submit"
          className={`rounded-full px-4 py-2 text-sm font-semibold text-white ${
            suspended
              ? "bg-red-900 hover:bg-red-800"
              : "bg-amber-900 hover:bg-amber-800"
          }`}
        >
          Add card
        </button>
      </form>
    </div>
  );
}
