import { CARD_LOOKUP_TIMEOUT_MS, withTimeout } from "@/lib/with-timeout";
import {
  brandedPriceLabel,
  formatUsd,
  marketplaceMonthlyTotal,
  marketplacePriceLabel,
  marketplacePriceWithCardLabel,
  setupServicePriceLabel,
} from "@/lib/hosting-prices";
import { MarketplaceCardBanner } from "@/components/marketplace-card-banner";
import {
  hasLiveCardSubscription,
  marketplaceCardState,
  marketplaceNeedsCard,
} from "@/lib/marketplace-billing-plan";
import {
  SETUP_ANCHOR,
  applySetupServiceSession,
  setupServiceDone,
} from "@/lib/setup-service";
import { BillingErrorAlert } from "@/components/billing/BillingErrorAlert";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSettingsShell } from "@/components/account-settings-shell";
import { FlashToast } from "@/components/flash-toast";
import { Button, Card } from "@/components/ui";
import { SUBSCRIBE_CHECKOUT_LABEL, UPDATE_CARD_LABEL } from "@/lib/billing-labels";
import { BrandedPendingBanner } from "@/components/branded-pending-banner";
import {
  HOSTING_BILLING_ROUTE,
  billingErrorMessage,
  brandedAwaitingPayment,
  brandedUpgradeConfirmPath,
} from "@/lib/branded-upgrade";
import { auth, requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  applyHostingCheckoutSession,
  describePlatformCard,
  ensureCustomerDefaultCard,
  promoteComplimentaryHostIfPaid,
} from "@/lib/platform-billing";
import {
  calculateHostingAmount,
  hostProductPath,
  sitePresenceLabel,
} from "@/lib/hosting";
import { hostingPriceId, isStripeConfigured } from "@/lib/stripe";
import { formatMoney } from "@/lib/utils";
import type { Host, HostingPlan } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscription" };

type HostWithPlan = Host & { plan: HostingPlan | null };

function statusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "PENDING_PAYMENT":
      return "Waiting for payment";
    case "PAST_DUE":
      return "Past due";
    case "PAUSED":
      return "Paused";
    case "CANCELLED":
      return "Cancelled";
    case "NONE":
      return "Not subscribed";
    default:
      return status.replaceAll("_", " ").toLowerCase();
  }
}

export default async function AccountSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{
    subscribed?: string;
    session_id?: string;
    canceled?: string;
    welcome?: string;
    upgraded?: string;
    upgrade?: string;
    billingError?: string;
    collectCards?: string;
    plan?: string;
    setup?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/account/settings/subscription");
  }
  const access = await requireHostAdmin();
  if (!access) {
    redirect("/account/settings");
  }
  const isPlatform = access.isPlatform;
  const scopedHostId = access.hostId;

  const sp = await searchParams;

  if (sp.session_id) {
    try {
      if (sp.setup === "paid") {
        // T45: one-time full setup (Checkout mode payment).
        await applySetupServiceSession(
          sp.session_id,
          isPlatform ? null : scopedHostId,
        );
      } else {
        await applyHostingCheckoutSession({ sessionId: sp.session_id });
      }
    } catch {
      // Webhook will catch up if Checkout retrieve fails.
    }
  }

  async function loadBrands(): Promise<HostWithPlan[]> {
    if (isPlatform) {
      return prisma.host.findMany({
        where: { hostingMode: "PLATFORM" },
        include: { plan: true },
        orderBy: { name: "asc" },
      });
    }
    if (!scopedHostId) return [];
    const one = await prisma.host.findUnique({
      where: { id: scopedHostId },
      include: { plan: true },
    });
    return one ? [one] : [];
  }

  const scopedHosts = await loadBrands();

  const publishedGroups = scopedHosts.length
    ? await prisma.property.groupBy({
        by: ["hostId"],
        where: {
          hostId: { in: scopedHosts.map((h) => h.id) },
          published: true,
        },
        _count: { _all: true },
      })
    : [];
  const publishedByHost = new Map(
    publishedGroups.map((g) => [g.hostId, g._count._all]),
  );

  const stripeOn = isStripeConfigured();
  const priceConfigured = Boolean(hostingPriceId());

  // T45: start the 14-day "add a card" grace the first time a Marketplace
  // brand with no card subscription opens this page (set once, never reset).
  if (stripeOn) {
    await Promise.all(
      scopedHosts
        .filter((h) => marketplaceNeedsCard(h) && !h.marketplaceGraceEndsAt)
        .map(async (h) => {
          const { ensureMarketplaceGrace } = await import(
            "@/lib/marketplace-billing"
          );
          await ensureMarketplaceGrace(h).catch(() => null);
        }),
    );
  }

  const cards = new Map<string, string | null>();
  await Promise.all(
    scopedHosts.map(async (host) => {
      if (
        host.plan &&
        host.plan.monthlyPrice <= 0 &&
        host.stripeSubscriptionStatus !== "paused" &&
        (host.stripeSubscriptionStatus === "active" ||
          Boolean(
            host.stripeSubscriptionId && host.subscriptionStatus === "ACTIVE",
          ))
      ) {
        await promoteComplimentaryHostIfPaid(host.id);
      }
      if (!stripeOn || !host.stripeCustomerId) {
        cards.set(host.id, null);
        return;
      }
      // T38b: the card label is nice to have. Never hold the page for it.
      const customerId = host.stripeCustomerId;
      const label = await withTimeout(
        (async () =>
          (await ensureCustomerDefaultCard(
            customerId,
            host.stripeSubscriptionId,
          )) || (await describePlatformCard(customerId)))(),
        CARD_LOOKUP_TIMEOUT_MS,
      ).catch(() => null);
      cards.set(host.id, label);
    }),
  );

  const hostsNow = await loadBrands();

  const billingError = billingErrorMessage(sp.billingError);
  const upgradeFlow = sp.upgrade === "branded";
  const marketplaceFlow = sp.plan === "marketplace";
  const flash = billingError
    ? {
        title: "Billing did not open",
        body: billingError,
        variant: "warn" as const,
      }
    : sp.setup === "paid"
    ? {
        title: "Setup purchased",
        body: "Setup purchased, we'll contact you. We set up your listings, brand and website.",
        variant: "success" as const,
      }
    : sp.setup === "canceled"
    ? {
        title: "Checkout canceled",
        body: "No charge was made. You can buy full setup from this page at any time.",
        variant: "warn" as const,
      }
    : sp.subscribed && marketplaceFlow
    ? {
        title: "Marketplace card is on",
        body: `Payment went through. You pay ${marketplacePriceWithCardLabel()}. Your published listings show on Find a Place.`,
        variant: "success" as const,
      }
    : sp.canceled && marketplaceFlow
    ? {
        title: "Checkout canceled",
        body: `No charge was made. Select ${SUBSCRIBE_CHECKOUT_LABEL} on this page to keep your listings on Find a Place.`,
        variant: "warn" as const,
      }
    : sp.subscribed && upgradeFlow
    ? {
        title: "Branded website is on",
        body: `Payment went through. That brand is on the ${brandedPriceLabel()} website plan — it covers every listing. Next: logo, colors, and domain under Brand & website.`,
        variant: "success" as const,
      }
    : sp.canceled && upgradeFlow
    ? {
        title: "Checkout canceled",
        body: "No charge was made. Your plan did not change: the brand stays on Marketplace only. You can upgrade again from this page.",
        variant: "warn" as const,
      }
    : sp.subscribed
    ? {
        title: "You're subscribed",
        body: sp.collectCards
          ? "Hosting is active on that brand. Guest cards are optional — set them up under Admin → Payments when you are ready."
          : "Hosting is active on that brand. The card is stored on the brand, not on your personal account.",
        variant: "success" as const,
      }
    : sp.upgraded === "website"
      ? {
          title: "Branded website is on",
          body: `That brand is on the ${brandedPriceLabel()} website plan — it covers every listing. Next: logo, colors, and domain under Brand & website.`,
          variant: "success" as const,
        }
      : sp.welcome
        ? {
            title: "Welcome — you're hosting",
            body: sp.collectCards
              ? "Add this brand’s hosting card first so Yall Come Back can bill you. Collecting guest cards is optional after that, under Admin → Payments."
              : "Each brand has its own Yall Come Back plan and card. Guest cards stay under Admin → Payments.",
            variant: "info" as const,
          }
        : sp.canceled
          ? {
              title: "Checkout canceled",
              body: "No charge was made. You can add a card from this page whenever you are ready.",
              variant: "warn" as const,
            }
          : null;

  return (
    <AccountSettingsShell
      active="subscription"
      isHost
      title="Subscription"
      description="Hosting is billed per brand, not on your personal login. Guest stay payments live under Admin → Payments — they never mix."
    >
      {billingError ? (
        // T38b: billing errors stay on the page (a toast can vanish before
        // the host sees it).
        <BillingErrorAlert code={sp.billingError} />
      ) : flash ? (
        <FlashToast
          title={flash.title}
          body={flash.body}
          variant={flash.variant}
        />
      ) : null}

      {hostsNow.length === 0 ? (
        <p className="text-sm text-stone-600">
          Pick a host brand first (brand switcher in Admin), then come back here
          to manage that brand&apos;s plan.
        </p>
      ) : (
        <div className="space-y-6">
          {hostsNow.map((host, index) => (
            <BrandHostingCard
              key={host.id}
              setupAnchor={index === 0}
              host={host}
              publishedCount={publishedByHost.get(host.id) ?? 0}
              cardOnFile={cards.get(host.id) ?? null}
              stripeOn={stripeOn}
              priceConfigured={priceConfigured}
            />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-stone-400">
        Guest cards, website deposit method, and extras stay under{" "}
        <Link href="/admin/payments" className="underline hover:text-stone-600">
          Admin → Payments
        </Link>
        . The card on a brand above is only that brand&apos;s Yall Come Back
        hosting.
      </p>
    </AccountSettingsShell>
  );
}

function BrandHostingCard({
  host,
  publishedCount,
  cardOnFile,
  stripeOn,
  priceConfigured,
  setupAnchor,
}: {
  setupAnchor: boolean;
  host: HostWithPlan;
  publishedCount: number;
  cardOnFile: string | null;
  stripeOn: boolean;
  priceConfigured: boolean;
}) {
  const product = hostProductPath(host);
  const marketplaceOnly = product === "marketplace";
  const branded = product === "website";
  const selfHost = product === "open_source";
  const complimentary = Boolean(host.plan && host.plan.monthlyPrice <= 0);
  const stripePaused =
    (host.stripeSubscriptionStatus || "").toLowerCase() === "paused";
  const needsFreshSubscribe =
    complimentary ||
    stripePaused ||
    host.subscriptionStatus !== "ACTIVE" ||
    !host.stripeSubscriptionId;
  const estimate = host.plan
    ? calculateHostingAmount(host.plan, publishedCount)
    : null;
  const liveCard = hasLiveCardSubscription(host);
  const cardState = marketplaceCardState(host);
  const marketplaceBill = marketplaceMonthlyTotal(
    publishedCount,
    host.plan?.monthlyPrice,
  );

  return (
    <div className="space-y-4">
      {brandedAwaitingPayment(host, host.plan) ? (
        <BrandedPendingBanner hostId={host.id} hostName={host.name} />
      ) : null}
      {marketplaceOnly && stripeOn ? (
        <MarketplaceCardBanner
          hostId={host.id}
          hostName={host.name}
          state={cardState}
          unitUsd={host.plan?.monthlyPrice}
        />
      ) : null}
      <Card className="space-y-4 p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bonnet">
            Brand
          </p>
          <h2 className="mt-1 text-lg font-semibold text-stone-900">
            {host.name}
          </h2>
          <p className="mt-1 text-sm font-medium text-stone-800">
            {selfHost
              ? "Free self-host"
              : complimentary
                ? "Complimentary"
                : sitePresenceLabel(host.sitePresence)}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {selfHost
              ? "This brand runs the site itself. No monthly platform fee."
              : complimentary
                ? "No monthly hosting fee on this brand."
                : marketplaceOnly
                  ? `${marketplacePriceWithCardLabel(host.plan?.monthlyPrice)}. Guests find this brand on Find a Place.`
                  : `${brandedPriceLabel(host.plan?.monthlyPrice ?? 25)} for the whole website. Add as many listings as you want. Marketplace listing included.`}
          </p>
        </div>

        {estimate && !complimentary && !selfHost ? (
          <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-700">
            {host.plan?.pricingModel === "FLAT" ? (
              <>
                This month: <strong>{brandedPriceLabel(estimate.amount)}</strong>{" "}
                for the whole website
                {publishedCount > 0
                  ? ` (${publishedCount} published listing${publishedCount === 1 ? "" : "s"})`
                  : ""}
                . Adding listings does not raise the hosting bill.
              </>
            ) : marketplaceOnly ? (
              <>
                Next bill:{" "}
                <strong>{formatUsd(marketplaceBill.netUsd)}</strong> +{" "}
                {formatUsd(marketplaceBill.cardUsd)} card processing
                {" · "}
                {marketplaceBill.listings} listing
                {marketplaceBill.listings === 1 ? "" : "s"}
                {publishedCount === 0
                  ? " (1 listing minimum until you publish)"
                  : ""}
                .
              </>
            ) : (
              <>
                Estimated this month:{" "}
                <strong>{formatMoney(estimate.amount)}</strong>
                {" · "}
                {estimate.propertyCount} published listing
                {estimate.propertyCount === 1 ? "" : "s"}
                {publishedCount === 0
                  ? " (1 listing minimum until you publish)"
                  : ""}
                .
              </>
            )}
          </p>
        ) : null}

        {marketplaceOnly && !selfHost && !complimentary ? (
          <div className="rounded-2xl border border-bonnet/25 bg-gradient-to-br from-petal/60 to-white p-4">
            <p className="text-sm font-semibold text-stone-900">
              Upgrade to a branded website
            </p>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              Own domain, logo, colors, and About page. Marketplace listing
              stays included.{" "}
              <strong>{brandedPriceLabel()} for the whole website</strong>,
              no matter how many listings you publish.
              {liveCard
                ? " Your Marketplace card plan stops when the website plan starts. Unused days go to your next bill as a credit."
                : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link
                href={brandedUpgradeConfirmPath(
                  host.id,
                  "/account/settings/subscription",
                )}
                className="rounded-full bg-bonnet px-4 py-2 text-sm font-semibold text-white hover:bg-bonnet/90"
              >
                Upgrade to branded website
              </Link>
              <Link
                href="/help/branded-website"
                className="text-sm font-semibold text-bonnet hover:underline"
              >
                How it works →
              </Link>
            </div>
          </div>
        ) : null}

        {branded && !complimentary ? (
          <p className="text-sm text-stone-600">
            Marketplace listing is included. Set logo, colors, and domain under{" "}
            <Link
              href="/admin/brand"
              className="font-semibold text-bonnet hover:underline"
            >
              Brand &amp; website
            </Link>
            .
          </p>
        ) : null}
        {complimentary && !selfHost ? (
          <p className="rounded-xl border border-sage/40 bg-sage/15 px-3 py-2 text-sm text-stone-800">
            Complimentary is $0 and is not billed. If you add a card and
            subscribe, <strong>{host.name}</strong> moves off complimentary onto{" "}
            {marketplaceOnly
              ? `${marketplacePriceLabel()} (marketplace).`
              : `${brandedPriceLabel()} for the whole website.`}
          </p>
        ) : null}
      </Card>

      {!selfHost && (!complimentary || branded) ? (
        <Card className="space-y-4 p-5 sm:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bonnet">
              {host.name} · billing
            </p>
            <h2 className="mt-1 text-lg font-semibold text-stone-900">
              Card on file for this brand
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {complimentary
                ? `Subscribing ends complimentary on ${host.name} and starts the ${brandedPriceLabel()} website plan. This is not your personal card.`
                : `Yall Come Back charges this card for ${host.name} hosting only. It is not your personal account card. Guests pay the host on a different account.`}
            </p>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Hosting status</dt>
              <dd className="font-medium text-stone-900">
                {statusLabel(host.subscriptionStatus)}
                {host.stripeSubscriptionStatus
                  ? ` · Stripe ${host.stripeSubscriptionStatus}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Card</dt>
              <dd className="font-medium text-stone-900">
                {cardOnFile || "No card on file yet"}
              </dd>
            </div>
          </dl>

          {host.subscriptionStatus === "PAST_DUE" ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Payment is late. 3-day grace, then pause after 5 unpaid days.
              Existing listings stay.
            </p>
          ) : null}
          {host.subscriptionStatus === "PAUSED" ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-950">
              Hosting is paused. Pay to take new stays again.
            </p>
          ) : null}
          {marketplaceOnly ? (
            <p className="text-sm text-stone-600">
              Marketplace-only is billed{" "}
              {marketplacePriceWithCardLabel(host.plan?.monthlyPrice)}. Each
              published listing is one line on the bill. When you publish,
              pause, archive or delete a listing, the next bill changes. There
              is no extra charge in the middle of the month.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {branded ? (
              <form method="post" action={HOSTING_BILLING_ROUTE}>
                <input type="hidden" name="intent" value="subscribe" />
                <input type="hidden" name="hostId" value={host.id} />
                <Button type="submit" disabled={!stripeOn || !priceConfigured}>
                  {complimentary
                    ? "Move to $25/mo website and subscribe"
                    : needsFreshSubscribe
                      ? SUBSCRIBE_CHECKOUT_LABEL
                      : "Manage billing"}
                </Button>
              </form>
            ) : null}
            {marketplaceOnly ? (
              <form method="post" action={HOSTING_BILLING_ROUTE}>
                <input type="hidden" name="intent" value="subscribe" />
                <input type="hidden" name="hostId" value={host.id} />
                <Button type="submit" disabled={!stripeOn}>
                  {liveCard ? "Manage billing" : SUBSCRIBE_CHECKOUT_LABEL}
                </Button>
              </form>
            ) : null}
            {/* T46: with no card yet, the only way to add one is
                SUBSCRIBE_CHECKOUT_LABEL above. The portal is for changing it. */}
            {cardOnFile ? (
              <form method="post" action={HOSTING_BILLING_ROUTE}>
                <input type="hidden" name="intent" value="portal" />
                <input type="hidden" name="hostId" value={host.id} />
                <Button type="submit" variant="secondary" disabled={!stripeOn}>
                  {UPDATE_CARD_LABEL}
                </Button>
              </form>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!selfHost && host.hostingMode === "PLATFORM" ? (
        <SetupServiceCard
          host={host}
          stripeOn={stripeOn}
          anchor={setupAnchor}
        />
      ) : null}
    </div>
  );
}

/** T45: $500 one-time full setup, on any plan, at any time. */
function SetupServiceCard({
  host,
  stripeOn,
  anchor,
}: {
  host: HostWithPlan;
  stripeOn: boolean;
  anchor: boolean;
}) {
  const done = setupServiceDone(host.setupServiceStatus);
  return (
    <Card
      id={anchor ? SETUP_ANCHOR : undefined}
      className="scroll-mt-24 space-y-3 p-5 sm:p-6"
      data-testid="setup-service-card"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bonnet">
          {host.name} · full setup
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
        <p className="rounded-xl border border-sage/40 bg-sage/15 px-3 py-2 text-sm font-medium text-stone-800">
          {host.setupServiceStatus === "WAIVED"
            ? "Full setup is included for this brand. We'll contact you."
            : "Setup purchased, we'll contact you."}
        </p>
      ) : (
        <>
          {host.setupServiceStatus === "REQUESTED" ? (
            <p className="text-sm text-stone-600">
              You asked for full setup when you signed up. Pay here to start.
            </p>
          ) : null}
          {host.setupServiceStatus === "INVOICED" ? (
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
              <input type="hidden" name="hostId" value={host.id} />
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
