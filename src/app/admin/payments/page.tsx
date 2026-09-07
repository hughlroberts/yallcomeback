import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import {
  createHostProduct,
  openBillingPortal,
  startConnectOnboarding,
  startHostingSubscription,
} from "@/app/actions/stripe-connect";
import { hostingPriceId, isStripeConfigured } from "@/lib/stripe";
import {
  listProductsOnConnectedAccount,
  retrieveConnectStatus,
  type ConnectOnboardingStatus,
} from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments · Admin" };

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; refresh?: string; subscribed?: string; canceled?: string }>;
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

  let products: {
    id: string;
    name: string;
    description: string | null;
    unitAmount: number | null;
    currency: string | null;
    priceId: string | null;
  }[] = [];
  if (stripeOn && host.stripeAccountId && status?.readyToProcessPayments) {
    try {
      const list = await listProductsOnConnectedAccount(host.stripeAccountId);
      products = list.data.map((p) => {
        const price = p.default_price;
        const expanded =
          price && typeof price === "object" ? price : null;
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          unitAmount:
            expanded && "unit_amount" in expanded
              ? (expanded.unit_amount as number | null)
              : null,
          currency:
            expanded && "currency" in expanded
              ? String(expanded.currency)
              : null,
          priceId:
            typeof price === "string"
              ? price
              : expanded && "id" in expanded
                ? String(expanded.id)
                : null,
        };
      });
    } catch {
      products = [];
    }
  }

  const sp = await searchParams;
  const priceConfigured = Boolean(hostingPriceId());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Payments</h1>
        <p className="mt-1 text-sm text-stone-600">
          Collect guest deposits on your own Stripe account. Yall Come Back
          does not take a cut of the stay — hosting is billed separately.
        </p>
      </div>

      {!stripeOn ? (
        <Card className="border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          Card payments are not enabled yet. An operator must set{" "}
          <code className="rounded bg-amber-100 px-1">STRIPE_ENABLED=true</code>{" "}
          and <code className="rounded bg-amber-100 px-1">STRIPE_SECRET_KEY</code>{" "}
          (from{" "}
          <a
            className="underline"
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noreferrer"
          >
            Dashboard → API keys
          </a>
          ).
        </Card>
      ) : null}

      {sp.refresh ? (
        <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
          Onboarding link expired. Click onboard again to continue.
        </p>
      ) : null}
      {sp.subscribed ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Hosting subscription checkout finished. Status updates when Stripe
          sends the webhook.
        </p>
      ) : null}

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold text-stone-900">Collect guest deposits</h2>
        {statusError ? (
          <p className="text-sm text-red-700">{statusError}</p>
        ) : null}
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
        ) : (
          <p className="text-sm text-stone-600">
            Not onboarded yet. Stripe hosts a form for identity and bank
            details. We store only the account id on this brand.
          </p>
        )}
        <form action={startConnectOnboarding}>
          <Button type="submit" disabled={!stripeOn}>
            Onboard to collect payments
          </Button>
        </form>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold text-stone-900">Website hosting subscription</h2>
        <p className="text-sm text-stone-600">
          Pay Yall Come Back&apos;s monthly hosting on this connected account
          (not a cut of guest stays). Current status:{" "}
          <strong>{host.subscriptionStatus.replaceAll("_", " ").toLowerCase()}</strong>
          {host.stripeSubscriptionStatus
            ? ` (Stripe: ${host.stripeSubscriptionStatus})`
            : ""}
          .
        </p>
        {!priceConfigured ? (
          <p className="text-sm text-amber-800">
            Operator must set{" "}
            <code className="rounded bg-amber-50 px-1">STRIPE_HOSTING_PRICE_ID</code>{" "}
            to a recurring Price in the Stripe Dashboard.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <form action={startHostingSubscription}>
            <Button type="submit" disabled={!stripeOn || !host.stripeAccountId || !priceConfigured}>
              Subscribe to hosting
            </Button>
          </form>
          <form action={openBillingPortal}>
            <Button
              type="submit"
              variant="secondary"
              disabled={!stripeOn || !host.stripeAccountId}
            >
              Manage billing
            </Button>
          </form>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold text-stone-900">Extras guests can buy</h2>
        <p className="text-sm text-stone-600">
          Products live on your connected account. Guests check out at{" "}
          <Link className="font-medium text-bonnet underline" href={`/pay/${host.slug}`}>
            /pay/{host.slug}
          </Link>
          .
        </p>
        <form action={createHostProduct} className="space-y-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Boat day" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div>
            <Label htmlFor="price">Price (USD)</Label>
            <Input
              id="price"
              name="price"
              type="number"
              min="1"
              step="0.01"
              required
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={!stripeOn || !status?.readyToProcessPayments}
          >
            Create product
          </Button>
        </form>
        {products.length > 0 ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {products.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{p.name}</span>
                  {p.description ? (
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {p.description}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-stone-700">
                  {p.unitAmount != null
                    ? `$${(p.unitAmount / 100).toFixed(2)}`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-500">No products yet.</p>
        )}
      </Card>
    </div>
  );
}
