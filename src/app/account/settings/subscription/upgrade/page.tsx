import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSettingsShell } from "@/components/account-settings-shell";
import { Card } from "@/components/ui";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";
import {
  HOSTING_BILLING_ROUTE,
  SUBSCRIPTION_PATH,
  brandedUpgradeNeedsCheckout,
  canUpgradeToBranded,
  safeBillingReturn,
} from "@/lib/branded-upgrade";
import { hostingPriceId, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upgrade to branded website" };

/**
 * T38 confirm step: Marketplace → Branded website. Nothing changes on this
 * page. "Continue to checkout" opens card checkout; the plan changes only
 * after the payment goes through.
 */
export default async function BrandedUpgradeConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ hostId?: string; returnTo?: string }>;
}) {
  const sp = await searchParams;
  const requested = sp.hostId?.trim() || undefined;
  const here = `${SUBSCRIPTION_PATH}/upgrade${requested ? `?hostId=${encodeURIComponent(requested)}` : ""}`;
  const access = await requireHostAdmin(requested);
  if (!access) redirect(`/login?callbackUrl=${encodeURIComponent(here)}`);
  if (!access.hostId) redirect(SUBSCRIPTION_PATH);
  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canManageBrand(info) && !access.isPlatform) {
    redirect(`${SUBSCRIPTION_PATH}?billingError=forbidden`);
  }

  const host = await prisma.host.findUnique({
    where: { id: access.hostId },
    include: { plan: { select: { monthlyPrice: true } } },
  });
  if (!host) redirect(SUBSCRIPTION_PATH);
  if (!canUpgradeToBranded(host)) {
    redirect(`${SUBSCRIPTION_PATH}?billingError=not_marketplace`);
  }

  const backHref = safeBillingReturn(sp.returnTo) || SUBSCRIPTION_PATH;
  const needsCheckout = brandedUpgradeNeedsCheckout(host, host.plan);
  const checkoutReady = isStripeConfigured() && Boolean(hostingPriceId());
  const canContinue = !needsCheckout || checkoutReady;

  return (
    <AccountSettingsShell
      active="subscription"
      isHost
      title="Upgrade to branded website"
      description="Check the plan, then confirm. Nothing changes on this page."
    >
      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bonnet">
            {host.name}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-stone-900">
            Marketplace only → Branded website
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
            {needsCheckout
              ? "$25 / month for the whole website. Add as many listings as you want. Marketplace listing stays included."
              : "This brand is complimentary. There is no charge for the branded website."}
          </p>
        </div>

        <ol className="space-y-2 text-sm text-stone-700">
          {needsCheckout ? (
            <>
              <li>
                1. Select <strong>Continue to checkout</strong>. You go to a
                secure card page.
              </li>
              <li>
                2. Your plan changes to Branded website only after the payment
                goes through. Then you can set your logo, colors and domain.
              </li>
              <li>
                3. If you cancel checkout, nothing changes. {host.name} stays on
                Marketplace only and you pay nothing.
              </li>
            </>
          ) : (
            <>
              <li>
                1. Select <strong>Switch to branded website</strong>.
              </li>
              <li>
                2. Brand tools (logo, colors, About, domain) open on Brand &amp;
                website.
              </li>
            </>
          )}
        </ol>

        {!canContinue ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Card checkout is not set up yet. Nothing changed. Try again later
            or contact support.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <form method="post" action={HOSTING_BILLING_ROUTE}>
            <input type="hidden" name="intent" value="upgrade" />
            <input type="hidden" name="hostId" value={host.id} />
            <button
              type="submit"
              disabled={!canContinue}
              className="rounded-full bg-bonnet px-5 py-2.5 text-sm font-semibold text-white hover:bg-bonnet/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {needsCheckout
                ? "Continue to checkout"
                : "Switch to branded website"}
            </button>
          </form>
          <Link
            href={backHref}
            className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            Cancel — stay on Marketplace
          </Link>
        </div>
      </Card>
    </AccountSettingsShell>
  );
}
