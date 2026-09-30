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
} from "@/lib/platform-billing";
import {
  calculateHostingAmount,
  hostProductPath,
  sitePresenceLabel,
} from "@/lib/hosting";
import { hostingPriceId, isStripeConfigured } from "@/lib/stripe";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscription" };

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

  const sp = await searchParams;

  if (!access.hostId) {
    return (
      <AccountSettingsShell
        active="subscription"
        isHost
        title="Subscription"
        description="Your Yall Come Back hosting plan — separate from guest stay payments."
      >
        <p className="text-sm text-stone-600">
          Pick a host brand first (brand switcher in Admin), then come back here
          to manage the plan.
        </p>
      </AccountSettingsShell>
    );
  }

  let host = await prisma.host.findUnique({
    where: { id: access.hostId },
    include: { plan: true },
  });
  if (!host) redirect("/account/settings");

  if (sp.session_id) {
    try {
      await applyHostingCheckoutSession({
        sessionId: sp.session_id,
        expectedHostId: host.id,
      });
    } catch {
      // Webhook will catch up if Checkout retrieve fails.
    }
    host = await prisma.host.findUnique({
      where: { id: access.hostId },
      include: { plan: true },
    });
    if (!host) redirect("/account/settings");
  }

  const stripeOn = isStripeConfigured();
  const priceConfigured = Boolean(hostingPriceId());
  let cardOnFile: string | null = null;
  if (stripeOn && host.stripeCustomerId) {
    try {
      cardOnFile = await ensureCustomerDefaultCard(
        host.stripeCustomerId,
        host.stripeSubscriptionId,
      );
      if (!cardOnFile) {
        cardOnFile = await describePlatformCard(host.stripeCustomerId);
      }
    } catch {
      cardOnFile = null;
    }
  }

  const publishedCount = await prisma.property.count({
    where: { hostId: host.id, published: true },
  });
  const product = hostProductPath(host);
  const marketplaceOnly = product === "marketplace";
  const branded = product === "website";
  const selfHost = product === "open_source";
  const complimentary = Boolean(host.plan && host.plan.monthlyPrice <= 0);
  const estimate = host.plan
    ? calculateHostingAmount(host.plan, publishedCount)
    : null;

  const flash = sp.subscribed
    ? {
        title: "You're subscribed",
        body: cardOnFile
          ? `Hosting is active. Card on file: ${cardOnFile}. This is what you pay Yall Come Back — not guest stay money.`
          : "Hosting is active. We'll charge the card you just added each month. This is separate from guest stay payments.",
        variant: "success" as const,
      }
    : sp.upgraded === "website"
      ? {
          title: "Branded website is on",
          body: "You're on the $25 / listing plan. Marketplace listing stays included. Next: logo, colors, and your domain under Brand & website.",
          variant: "success" as const,
        }
      : sp.welcome
        ? {
            title: "Welcome — you're hosting",
            body: "This tab is your Yall Come Back subscription. Add a card when you are ready to go live. Guest cards are set up separately under Admin → Payments.",
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
      description="What you pay Yall Come Back. Guest stay payments live under Admin → Payments — they never mix."
    >
      {flash ? (
        <FlashToast
          title={flash.title}
          body={flash.body}
          variant={flash.variant}
        />
      ) : null}

      <Card className="space-y-4 p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bonnet">
            Your plan
          </p>
          <h2 className="mt-1 text-lg font-semibold text-stone-900">
            {selfHost
              ? "Free self-host"
              : complimentary
                ? "Complimentary"
                : sitePresenceLabel(host.sitePresence)}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {selfHost
              ? "You run the site yourself. No monthly platform fee."
              : complimentary
                ? "No monthly hosting fee on this brand."
                : marketplaceOnly
                  ? `${formatMoney(host.plan?.monthlyPrice ?? 5)} per published listing / month. Guests find you on Find a Place.`
                  : `${formatMoney(host.plan?.monthlyPrice ?? 25)} per published listing / month. Brand site on your domain; marketplace listing included.`}
          </p>
        </div>

        {estimate && !complimentary && !selfHost ? (
          <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-700">
            Estimated this month:{" "}
            <strong>{formatMoney(estimate.amount)}</strong>
            {" · "}
            {estimate.propertyCount} published listing
            {estimate.propertyCount === 1 ? "" : "s"}
            {publishedCount === 0
              ? " (1 listing minimum until you publish)"
              : ""}
            .
          </p>
        ) : null}

        {marketplaceOnly && !selfHost && !complimentary ? (
          <div className="rounded-2xl border border-bonnet/25 bg-gradient-to-br from-petal/60 to-white p-4">
            <p className="text-sm font-semibold text-stone-900">
              Upgrade to a branded website
            </p>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              Your own domain, logo, colors, and About page. Marketplace
              listing stays included — you do not pay $5 on top.{" "}
              <strong>{formatMoney(25)} / published listing / month.</strong>
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
      </Card>

      {!selfHost && !complimentary ? (
        <Card className="mt-4 space-y-4 p-5 sm:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bonnet">
              Billing
            </p>
            <h2 className="mt-1 text-lg font-semibold text-stone-900">
              Card on file
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Yall Come Back charges this card for hosting. Guests pay you on a
              different account.
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
              Payment is late. You have a 3-day grace period. After 5 unpaid
              days we pause new listings and new stays. Existing listings stay.
            </p>
          ) : null}
          {host.subscriptionStatus === "PAUSED" ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-950">
              Hosting is paused. Add a card and pay to take new stays again.
              Existing listings and bookings are unchanged.
            </p>
          ) : null}
          {host.subscriptionStatus === "ACTIVE" && !cardOnFile ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Hosting is active, but we do not see a default card yet. Use
              Update card so monthly invoices can charge it.
            </p>
          ) : null}
          {!priceConfigured ? (
            <p className="text-sm text-amber-800">
              Card checkout is not configured yet. Ops still invoices from your
              plan price.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <form action={startHostingSubscription}>
              <Button type="submit" disabled={!stripeOn || !priceConfigured}>
                {host.subscriptionStatus === "ACTIVE"
                  ? "Manage billing"
                  : "Add card and subscribe"}
              </Button>
            </form>
            <form action={openBillingPortal}>
              <Button type="submit" variant="secondary" disabled={!stripeOn}>
                {cardOnFile ? "Update card" : "Add a card"}
              </Button>
            </form>
          </div>
        </Card>
      ) : null}

      <p className="mt-6 text-xs leading-relaxed text-stone-400">
        Guest cards, website deposit method, and extras stay under{" "}
        <Link href="/admin/payments" className="underline hover:text-stone-600">
          Admin → Payments
        </Link>
        . This page is only your Yall Come Back subscription.
      </p>
    </AccountSettingsShell>
  );
}
