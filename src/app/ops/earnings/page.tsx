import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { loadOpsEarnings } from "@/lib/platform-earnings";
import { subscriptionLabel } from "@/lib/hosting";
import { formatDateUS, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings · Ops" };

function stripeInvoiceUrl(id: string | null | undefined, hosted: string | null | undefined) {
  if (hosted) return hosted;
  if (id) return `https://dashboard.stripe.com/invoices/${id}`;
  return null;
}

export default async function OpsEarningsPage() {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/earnings");

  const data = await loadOpsEarnings();
  const payingCustomers = data.customers.filter((c) => !c.complimentary);
  const complimentary = data.customers.filter((c) => c.complimentary);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Earnings</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">
          What hosts pay Yall Come Back for hosting — including the card
          processing line on Checkout. Guest stay money never appears here;
          that goes to the host. Approvals and invoice tools stay on{" "}
          <Link href="/ops/hosting" className="font-medium text-bonnet hover:underline">
            Website hosting
          </Link>
          .
        </p>
      </div>

      {data.sync.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Could not refresh Stripe invoices: {data.sync.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-sm text-stone-500">Collected this month</p>
          <p className="mt-1 text-3xl font-semibold">
            {formatMoney(data.collectedThisMonth)}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {data.paymentsThisMonth} payment
            {data.paymentsThisMonth === 1 ? "" : "s"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Active paying hosts</p>
          <p className="mt-1 text-3xl font-semibold">{data.payingCount}</p>
          <p className="mt-1 text-xs text-stone-400">
            {data.customerCount} billed brand
            {data.customerCount === 1 ? "" : "s"} on a paid plan
          </p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Plan MRR (estimated)</p>
          <p className="mt-1 text-3xl font-semibold">{formatMoney(data.mrr)}</p>
          <p className="mt-1 text-xs text-stone-400">
            Website is $25 flat; marketplace is $12 × listings (+ add-ons),
            before processing
          </p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Open / failed invoices</p>
          <p className="mt-1 text-3xl font-semibold">{data.openInvoices.length}</p>
        </Card>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Customers</h2>
        <p className="mt-1 text-sm text-stone-500">
          Platform hosts and what they subscribe to. Complimentary brands are
          listed at the bottom and are not billed.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Host</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Listings</th>
                <th className="px-4 py-3 font-medium">Est. monthly</th>
                <th className="px-4 py-3 font-medium">Last paid</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Period ends</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {payingCustomers.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-stone-100 hover:bg-stone-50/80"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/ops/hosting/${c.id}`}
                      className="font-medium text-stone-900 hover:text-bonnet"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-stone-500">
                      {c.email || `/h/${c.slug}`}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-900">{c.productLabel}</p>
                    <p className="text-xs text-stone-500">
                      {c.planName}
                      {c.unitPrice > 0
                        ? c.pricingModel === "FLAT"
                          ? ` · ${formatMoney(c.unitPrice)}/mo total`
                          : ` · ${formatMoney(c.unitPrice)}/listing`
                        : ""}
                      {c.addon > 0 ? ` + intel ${formatMoney(c.addon)}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">{c.published}</td>
                  <td className="px-4 py-3 font-medium">
                    {formatMoney(c.estimateAmount)}
                  </td>
                  <td className="px-4 py-3">
                    {c.lastPaidAmount != null ? (
                      <>
                        <p className="font-medium">
                          {formatMoney(c.lastPaidAmount)}
                        </p>
                        <p className="text-xs text-stone-500">
                          {c.lastPaidAt ? formatDateUS(c.lastPaidAt) : ""}
                        </p>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {subscriptionLabel(c.subscriptionStatus)}
                    {c.stripeSubscriptionStatus
                      ? ` · ${c.stripeSubscriptionStatus}`
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {c.periodEnd ? formatDateUS(c.periodEnd) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/ops/hosting/${c.id}`}
                      className="font-medium text-bonnet hover:underline"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
              {payingCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-sm text-stone-500"
                  >
                    No paying hosts yet. Checkout charges show under Recent
                    payments once Stripe invoices sync.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {complimentary.length > 0 ? (
          <p className="mt-3 text-xs text-stone-400">
            Complimentary (not billed):{" "}
            {complimentary.map((c) => c.name).join(", ")}
          </p>
        ) : null}
      </section>

      {data.openInvoices.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold">Open invoices</h2>
          <div className="mt-4 space-y-3">
            {data.openInvoices.map((inv) => (
              <Card
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium">{inv.host.name}</p>
                  <p className="text-sm text-stone-500">
                    {formatMoney(inv.amount)} · {inv.status.toLowerCase()}
                    {inv.plan ? ` · ${inv.plan.name}` : ""}
                    {inv.dueDate ? ` · due ${formatDateUS(inv.dueDate)}` : ""}
                  </p>
                </div>
                <Link
                  href={`/ops/hosting/${inv.host.id}`}
                  className="text-sm font-medium text-bonnet hover:underline"
                >
                  Host →
                </Link>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">Recent payments</h2>
        <p className="mt-1 text-sm text-stone-500">
          Paid hosting invoices, including Stripe Checkout subscriptions.
          The card total is what Stripe charged (plan + processing).
        </p>
        {data.paidInvoices.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">No hosting payments yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Host</th>
                  <th className="px-4 py-3 font-medium">What</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {data.paidInvoices.map((inv) => {
                  const url = stripeInvoiceUrl(
                    inv.stripeInvoiceId,
                    inv.stripeHostedInvoiceUrl,
                  );
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-stone-100 hover:bg-stone-50/80"
                    >
                      <td className="px-4 py-3 text-stone-600">
                        {inv.paidAt ? formatDateUS(inv.paidAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/ops/hosting/${inv.host.id}`}
                          className="font-medium text-stone-900 hover:text-bonnet"
                        >
                          {inv.host.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {inv.plan?.name || "Hosting"}
                        {inv.notes ? (
                          <p className="mt-0.5 max-w-md text-xs text-stone-400">
                            {inv.notes}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatMoney(inv.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-bonnet hover:underline"
                          >
                            Stripe →
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
