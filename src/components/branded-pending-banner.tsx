import { SUBSCRIBE_CHECKOUT_LABEL } from "@/lib/billing-labels";
import { HOSTING_BILLING_ROUTE } from "@/lib/branded-upgrade";

/**
 * Branded website chosen but not paid yet. Guests do not see the branded
 * site until the hosting subscription is paid (isHostPublicLive).
 * Plain form POST (not a server action) so the first click always loads.
 */
export function BrandedPendingBanner({
  hostId,
  hostName,
}: {
  hostId: string;
  hostName: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p>
        <strong>Branded website · Waiting for payment.</strong> The branded site
        for {hostName} stays off for guests until you pay. Select {SUBSCRIBE_CHECKOUT_LABEL}{" "}
        to start the plan.
      </p>
      <form method="post" action={HOSTING_BILLING_ROUTE}>
        <input type="hidden" name="intent" value="subscribe" />
        <input type="hidden" name="hostId" value={hostId} />
        <button
          type="submit"
          className="rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
        >
          {SUBSCRIBE_CHECKOUT_LABEL}
        </button>
      </form>
    </div>
  );
}
