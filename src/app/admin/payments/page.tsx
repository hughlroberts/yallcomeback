import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button, Card } from "@/components/ui";
import { isStripeConfigured } from "@/lib/stripe";
import { AutoStartConnectOnboarding } from "@/components/auto-start-connect-onboarding";
import {
  retrieveConnectStatus,
  type ConnectOnboardingStatus,
} from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments · Admin" };

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    accountId?: string;
    refresh?: string;
    subscribed?: string;
    canceled?: string;
    welcome?: string;
    session_id?: string;
    startOnboarding?: string;
    error?: string;
  }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/payments");
  if (!access.hostId) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-stone-600">
          Pick a host brand first (brand switcher), then onboard that brand to
          collect card payments.
        </p>
      </div>
    );
  }

  const host = await prisma.host.findUnique({
    where: { id: access.hostId },
  });
  if (!host) redirect("/admin");

  const stripeOn = isStripeConfigured();
  let status: ConnectOnboardingStatus | null = null;
  let statusError: string | null = null;
  if (stripeOn && host.stripeAccountId) {
    try {
      // Always read onboarding from the Stripe API — do not trust a DB cache.
      status = await retrieveConnectStatus(host.stripeAccountId);
    } catch (e) {
      statusError = e instanceof Error ? e.message : "Could not load account status";
    }
  }

  const sp = await searchParams;
  if (sp.subscribed || sp.canceled || sp.welcome || sp.session_id) {
    const q = new URLSearchParams();
    if (sp.subscribed) q.set("subscribed", sp.subscribed);
    if (sp.session_id) q.set("session_id", sp.session_id);
    if (sp.canceled) q.set("canceled", sp.canceled);
    if (sp.welcome) q.set("welcome", sp.welcome);
    redirect(`/account/settings/subscription?${q.toString()}`);
  }

  const needsOnboarding = !status?.onboardingComplete;
  const autoStart =
    Boolean(sp.startOnboarding) && stripeOn && needsOnboarding;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Payments</h1>
        <p className="mt-1 text-sm text-stone-600">
          Collect guest cards. Deposit method is set on each listing (and asked
          again when you add a booking). Yall Come Back does not take a cut of
          the stay. Your hosting plan and card for Yall Come Back live under{" "}
          <Link
            href="/account/settings/subscription"
            className="font-semibold text-bonnet hover:underline"
          >
            Account → Subscription
          </Link>
          .
        </p>
      </div>

      {!stripeOn ? (
        <Card className="border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          Card payments are not enabled yet. Create your own Stripe account,
          then set{" "}
          <code className="rounded bg-amber-100 px-1">STRIPE_ENABLED=true</code>{" "}
          and <code className="rounded bg-amber-100 px-1">STRIPE_SECRET_KEY</code>{" "}
          from{" "}
          <a
            className="underline"
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noreferrer"
          >
            Dashboard → API keys
          </a>
          . Do not copy keys from another Yall Come Back site.
        </Card>
      ) : null}

      {sp.refresh ? (
        <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
          Onboarding link expired. Click onboard again to continue.
        </p>
      ) : null}

      {sp.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {sp.error}
        </p>
      ) : null}

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold text-stone-900">Collect guest cards</h2>
        {needsOnboarding ? (
          <p className="text-sm text-stone-600">
            Guests pay you. Payouts and the processor fee stay on this connected
            account — never on Yall Come Back. Required for Find a Place, and for
            any listing you set to online card. You can skip and come back here
            later.
          </p>
        ) : (
          <p className="text-sm text-stone-600">
            Guests pay you. Payouts and the processor fee stay on this connected
            account — never on Yall Come Back.
          </p>
        )}
        {statusError ? (
          <p className="text-sm text-red-700">{statusError}</p>
        ) : null}
        {autoStart ? <AutoStartConnectOnboarding /> : null}
        {status ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Connected account</dt>
              <dd className="font-mono text-xs">{status.accountId}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Card payments</dt>
              <dd className="font-medium">
                {status.readyToProcessPayments
                  ? "Active"
                  : status.cardPaymentsStatus || "Not active"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Onboarding</dt>
              <dd className="font-medium">
                {status.onboardingComplete ? "Complete" : "Needs information"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Requirements</dt>
              <dd>{status.requirementsStatus || "—"}</dd>
            </div>
          </dl>
        ) : !autoStart ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-stone-800">
              Set up card collection now?
            </legend>
            <p className="text-xs text-stone-500">
              Stripe hosts a form for identity and bank details. We store only
              the account id on this brand.
            </p>
          </fieldset>
        ) : null}
        {!autoStart ? (
          <div className="flex flex-wrap items-center gap-3">
            <form action="/api/stripe/connect/onboard" method="post">
              <Button type="submit" disabled={!stripeOn}>
                {status
                  ? "Continue card onboarding"
                  : "Yes, collect guest cards"}
              </Button>
            </form>
            {needsOnboarding ? (
              <Link
                href="/admin"
                className="text-sm font-medium text-stone-600 underline-offset-2 hover:text-bonnet hover:underline"
              >
                Skip for now
              </Link>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
