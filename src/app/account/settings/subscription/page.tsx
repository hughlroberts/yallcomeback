import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSettingsShell } from "@/components/account-settings-shell";
import { FlashToast } from "@/components/flash-toast";
import { Button, Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { upgradeToBrandedWebsite } from "@/app/actions/host";
import {
  openBillingPortal,
  startHostingSubscription,
} from "@/app/actions/stripe-connect";
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
      await applyHostingCheckoutSession({ sessionId: sp.session_id });
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
      try {
        let label = await ensureCustomerDefaultCard(
          host.stripeCustomerId,
          host.stripeSubscriptionId,
        );
        if (!label) {
          label = await describePlatformCard(host.stripeCustomerId);
        }
        cards.set(host.id, label);
      } catch {
        cards.set(host.id, null);
      }
    }),
  );

  const hostsNow = await loadBrands();

  const flash = sp.subscribed
    ? {
        title: "You're subscribed",
        body: "Hosting is active on that brand. The card is stored on the brand, not on your personal account.",
        variant: "success" as const,
      }
    : sp.upgraded === "website"
      ? {
          title: "Branded website is on",
          body: "That brand is on the $25 / month website plan — it covers every listing. Next: logo, colors, and domain under Brand & website.",
          variant: "success" as const,
        }
      : sp.welcome
        ? {
            title: "Welcome — you're hosting",
            body: "Each brand has its own Yall Come Back plan and card. Guest cards stay under Admin → Payments.",
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
      {flash ? (
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
          {hostsNow.map((host) => (
            <BrandHostingCard
              key={host.id}
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
}: {
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
  const estimate = host.plan
    ? calculateHostingAmount(host.plan, publishedCount)
    : null;

  return (
    <div className="space-y-4">
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
                  ? `${formatMoney(host.plan?.monthlyPrice ?? 5)} per published listing / month. Guests find this brand on Find a Place.`
                  : `${formatMoney(host.plan?.monthlyPrice ?? 25)} / month for the whole website. Add as many listings as you want. Marketplace listing included.`}
          </p>
        </div>

        {estimate && !complimentary && !selfHost ? (
          <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-700">
            {host.plan?.pricingModel === "FLAT" ? (
              <>
                This month: <strong>{formatMoney(estimate.amount)}</strong> for
                the whole website
                {publishedCount > 0
                  ? ` (${publishedCount} published listing${publishedCount === 1 ? "" : "s"})`
                  : ""}
                . Adding listings does not raise the hosting bill.
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
              <strong>{formatMoney(25)} / month for the whole website</strong>,
              no matter how many listings you publish.
            </p>
            <form
              action={upgradeToBrandedWebsite}
              className="mt-3 flex flex-wrap items-center gap-3"
            >
              <input type="hidden" name="hostId" value={host.id} />
              <SubmitButton
                pendingLabel="Upgrading…"
                className="rounded-full bg-bonnet px-4 py-2 text-sm font-semibold text-white hover:bg-bonnet/90"
              >
                Upgrade to branded website
              </SubmitButton>
              <Link
                href="/help/branded-website"
                className="text-sm font-semibold text-bonnet hover:underline"
              >
                How it works →
              </Link>
            </form>
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
              ? `${formatMoney(5)} per published listing / month (marketplace).`
              : `${formatMoney(25)} / month for the whole website.`}
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
                ? `Subscribing ends complimentary on ${host.name} and starts the $25 / month website plan. This is not your personal card.`
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
              Hosting is paused. Add a card and pay to take new stays again.
            </p>
          ) : null}
          {marketplaceOnly ? (
            <p className="text-sm text-stone-600">
              Marketplace-only is billed{" "}
              {formatMoney(host.plan?.monthlyPrice ?? 5)} per published listing.
              That is not the $25 website subscription.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {branded ? (
              <form action={startHostingSubscription}>
                <input type="hidden" name="hostId" value={host.id} />
                <Button type="submit" disabled={!stripeOn || !priceConfigured}>
                  {complimentary
                    ? "Move to $25/mo website and subscribe"
                    : host.subscriptionStatus === "ACTIVE"
                      ? "Manage billing"
                      : "Add card and subscribe"}
                </Button>
              </form>
            ) : null}
            <form action={openBillingPortal}>
              <input type="hidden" name="hostId" value={host.id} />
              <Button type="submit" variant="secondary" disabled={!stripeOn}>
                {cardOnFile ? "Update card" : "Add a card"}
              </Button>
            </form>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
