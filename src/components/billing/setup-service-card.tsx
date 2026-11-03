import { Button, Card } from "@/components/ui";
import { HOSTING_BILLING_ROUTE } from "@/lib/branded-upgrade";
import { setupServicePriceLabel } from "@/lib/hosting-prices";
import { SETUP_ANCHOR, setupServiceDone } from "@/lib/setup-service";

/**
 * T45: $500 one-time full setup, on any plan, at any time.
 * T46: INVOICED shows the "pay that invoice" notice and no card button,
 * so a brand that was invoiced by hand cannot also pay by card here.
 */
export function SetupServiceCard({
  hostId,
  hostName,
  setupServiceStatus,
  stripeOn,
  anchor,
}: {
  hostId: string;
  hostName: string;
  setupServiceStatus: string;
  stripeOn: boolean;
  anchor: boolean;
}) {
  const done = setupServiceDone(setupServiceStatus);
  return (
    <Card
      id={anchor ? SETUP_ANCHOR : undefined}
      className="scroll-mt-24 space-y-3 p-5 sm:p-6"
      data-testid="setup-service-card"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bonnet">
          {hostName} · full setup
        </p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">
          Full setup
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          We set up your listings, brand and website for you.{" "}
          <strong>{setupServicePriceLabel()}</strong>. You pay one time. Your
          monthly plan does not change.
        </p>
      </div>
      {done ? (
        <p
          className="rounded-xl border border-sage/40 bg-sage/15 px-3 py-2 text-sm font-medium text-stone-800"
          data-testid="setup-done"
        >
          {setupServiceStatus === "WAIVED"
            ? "Full setup is included for this brand. We'll contact you."
            : "Setup purchased, we'll contact you."}
        </p>
      ) : (
        <>
          {setupServiceStatus === "REQUESTED" ? (
            <p className="text-sm text-stone-600">
              You asked for full setup when you signed up. Pay here to start.
            </p>
          ) : null}
          {setupServiceStatus === "INVOICED" ? (
            <p
              className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950"
              data-testid="setup-invoiced"
            >
              We already sent you an invoice for full setup. Pay that invoice.
              You cannot pay by card here, so you are not charged twice.
            </p>
          ) : (
            <form method="post" action={HOSTING_BILLING_ROUTE}>
              <input type="hidden" name="intent" value="setup" />
              <input type="hidden" name="hostId" value={hostId} />
              <Button type="submit" disabled={!stripeOn}>
                Buy full setup
              </Button>
            </form>
          )}
        </>
      )}
    </Card>
  );
}
