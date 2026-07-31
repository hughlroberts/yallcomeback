import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import {
  approveHost,
  rejectHost,
  issueHostingInvoice,
  markHostingInvoicePaidAction,
  voidHostingInvoice,
} from "@/app/actions/hosting";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import {
  approvalLabel,
  daysUntil,
  formatPlanPrice,
  hostingModeLabel,
  setupServiceLabel,
  sitePresenceLabel,
  subscriptionLabel,
} from "@/lib/hosting";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website hosting · Ops" };

export default async function OpsHostingPage() {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/hosting");

  const [pending, hosts, openInvoices, plans, renewals] = await Promise.all([
    prisma.host.findMany({
      where: { approvalStatus: "PENDING_REVIEW" },
      include: {
        plan: true,
        users: { where: { role: "HOST" }, take: 1 },
        _count: { select: { properties: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.host.findMany({
      include: {
        plan: true,
        invoices: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { properties: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.hostingInvoice.findMany({
      where: { status: "OPEN" },
      include: { host: true, plan: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.hostingPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.host.findMany({
      where: {
        hostingMode: "PLATFORM",
        approvalStatus: "APPROVED",
        subscriptionStatus: { in: ["ACTIVE", "PAST_DUE", "PENDING_PAYMENT"] },
      },
      include: { plan: true },
      orderBy: { currentPeriodEnd: "asc" },
    }),
  ]);

  const renewalSoon = renewals.filter((h) => {
    const d = daysUntil(h.currentPeriodEnd);
    return d !== null && d <= 14;
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Website hosting</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            Hosts who do not self-host get a site on this platform. After you
            approve them, charge a{" "}
            <strong className="font-medium text-stone-700">
              monthly hosting fee per property
            </strong>{" "}
            (scales with listings; not a cut of each booking). Stripe invoices
            when configured; otherwise mark paid manually.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/ops/hosting/plans"
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
          >
            Plans & pricing
          </Link>
          <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-600">
            Stripe: {isStripeConfigured() ? "on" : "manual mode"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-stone-500">Pending approval</p>
          <p className="mt-1 text-3xl font-semibold">{pending.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Open hosting invoices</p>
          <p className="mt-1 text-3xl font-semibold">{openInvoices.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Renewals in 14 days</p>
          <p className="mt-1 text-3xl font-semibold">{renewalSoon.length}</p>
        </Card>
      </div>

      {/* Approvals */}
      <section>
        <h2 className="text-lg font-semibold">Approvals</h2>
        <p className="mt-1 text-sm text-stone-500">
          Review new hosts. Approval unlocks invoicing; the public site stays
          offline until the first hosting invoice is paid (platform-hosted).
        </p>
        {pending.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">No hosts waiting for review.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {pending.map((host) => (
              <Card key={host.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{host.name}</p>
                    <p className="text-sm text-stone-500">
                      /h/{host.slug} · {host.users[0]?.email || host.billingEmail}{" "}
                      · {host._count.properties} properties · requested{" "}
                      {hostingModeLabel(host.hostingMode)}
                    </p>
                    {host.tagline ? (
                      <p className="mt-1 text-sm text-stone-600">{host.tagline}</p>
                    ) : null}
                    {host.setupServiceStatus !== "NONE" ? (
                      <p className="mt-2 text-sm font-medium text-bonnet">
                        Full setup · {setupServiceLabel(host.setupServiceStatus)}{" "}
                        · ${host.setupServiceAmount}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                    {approvalLabel(host.approvalStatus)}
                  </span>
                </div>

                <form action={approveHost} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="hostId" value={host.id} />
                  <div>
                    <Label htmlFor={`mode-${host.id}`}>Hosting mode</Label>
                    <select
                      id={`mode-${host.id}`}
                      name="hostingMode"
                      defaultValue={host.hostingMode}
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    >
                      <option value="PLATFORM">
                        Platform-hosted (monthly fee)
                      </option>
                      <option value="SELF">Self-hosted (no hosting fee)</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={`plan-${host.id}`}>
                      Hosting fee / plan
                    </Label>
                    <select
                      id={`plan-${host.id}`}
                      name="planId"
                      defaultValue={
                        host.planId ||
                        plans.find((p) => p.isDefault)?.id ||
                        plans[0]?.id ||
                        ""
                      }
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {formatPlanPrice(p, formatMoney)}
                          {p.monthlyPrice <= 0 ? " (no charge)" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-stone-400">
                      Use Complimentary for your own brand or free partners —
                      they stay a customer with $0 invoices.
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`notes-${host.id}`}>Internal notes</Label>
                    <Textarea
                      id={`notes-${host.id}`}
                      name="approvalNotes"
                      rows={2}
                      defaultValue={host.approvalNotes || ""}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      name="issueInvoice"
                      defaultChecked
                    />
                    Issue first hosting invoice after approval (platform mode)
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Button type="submit">Approve</Button>
                  </div>
                </form>

                <form action={rejectHost} className="flex flex-wrap items-end gap-2 border-t border-stone-100 pt-4">
                  <input type="hidden" name="hostId" value={host.id} />
                  <div className="min-w-[200px] flex-1">
                    <Label>Rejection reason</Label>
                    <Input name="approvalNotes" placeholder="Optional note to record" />
                  </div>
                  <Button type="submit" variant="danger">
                    Reject
                  </Button>
                </form>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Open invoices */}
      <section>
        <h2 className="text-lg font-semibold">Open invoices</h2>
        {openInvoices.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No open hosting invoices.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {openInvoices.map((inv) => (
              <Card
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium">{inv.host.name}</p>
                  <p className="text-sm text-stone-500">
                    {formatMoney(inv.amount)}{" "}
                    {inv.pricingModel === "PER_PROPERTY"
                      ? `(${inv.propertyCount} × ${formatMoney(inv.unitPrice)})`
                      : "(flat)"}{" "}
                    · {inv.periodStart.toISOString().slice(0, 10)} →{" "}
                    {inv.periodEnd.toISOString().slice(0, 10)}
                    {inv.dueDate
                      ? ` · due ${inv.dueDate.toISOString().slice(0, 10)}`
                      : ""}
                    {inv.plan ? ` · ${inv.plan.name}` : ""}
                  </p>
                  {inv.stripeHostedInvoiceUrl ? (
                    <a
                      href={inv.stripeHostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-sm text-bonnet hover:underline"
                    >
                      Stripe invoice link →
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-stone-400">
                      Manual invoice (no Stripe URL)
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={markHostingInvoicePaidAction}>
                    <input type="hidden" name="invoiceId" value={inv.id} />
                    <Button type="submit">Mark paid</Button>
                  </form>
                  <form action={voidHostingInvoice}>
                    <input type="hidden" name="invoiceId" value={inv.id} />
                    <Button type="submit" variant="secondary">
                      Void
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Renewals */}
      <section>
        <h2 className="text-lg font-semibold">Renewals</h2>
        <p className="mt-1 text-sm text-stone-500">
          Issue the next month&apos;s hosting invoice when a period is ending.
        </p>
        <div className="mt-4 space-y-3">
          {renewals.map((host) => {
            const d = daysUntil(host.currentPeriodEnd);
            return (
              <Card
                key={host.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium">{host.name}</p>
                  <p className="text-sm text-stone-500">
                    {subscriptionLabel(host.subscriptionStatus)}
                    {host.plan
                      ? ` · ${host.plan.name} ${formatPlanPrice(host.plan, formatMoney)}`
                      : ""}
                    {host.currentPeriodEnd
                      ? ` · period ends ${host.currentPeriodEnd.toISOString().slice(0, 10)}`
                      : " · no period set"}
                    {d !== null ? ` (${d}d)` : ""}
                  </p>
                </div>
                <form action={issueHostingInvoice} className="flex items-center gap-2">
                  <input type="hidden" name="hostId" value={host.id} />
                  <input type="hidden" name="planId" value={host.planId || ""} />
                  <input
                    type="hidden"
                    name="notes"
                    value="Renewal invoice"
                  />
                  <Button type="submit" variant="secondary">
                    Issue renewal invoice
                  </Button>
                </form>
              </Card>
            );
          })}
          {renewals.length === 0 && (
            <p className="text-sm text-stone-500">No platform-hosted subscriptions yet.</p>
          )}
        </div>
      </section>

      {/* All hosts */}
      <section>
        <h2 className="text-lg font-semibold">All hosts</h2>
        <p className="mt-1 text-sm text-stone-500">
          Click a host to edit plan, domain, billing, and see all listings.
          Complimentary = free for your brand (any number of properties). Paying
          customers only see paid plans at signup.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Host</th>
                <th className="px-4 py-3 font-medium">Listings</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Guest site</th>
                <th className="px-4 py-3 font-medium">Marketplace</th>
                <th className="px-4 py-3 font-medium">Approval</th>
                <th className="px-4 py-3 font-medium">Subscription</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {hosts.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-stone-100 hover:bg-stone-50/80"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/ops/hosting/${h.id}`}
                      className="font-medium text-stone-900 hover:text-bonnet"
                    >
                      {h.name}
                    </Link>
                    <p className="text-xs text-stone-500">
                      {h.websiteUrl
                        ? h.websiteUrl.replace(/^https?:\/\//i, "")
                        : `/h/${h.slug}`}
                    </p>
                  </td>
                  <td className="px-4 py-3">{h._count.properties}</td>
                  <td className="px-4 py-3">{hostingModeLabel(h.hostingMode)}</td>
                  <td className="px-4 py-3">
                    {h.hostingMode === "SELF"
                      ? "Own domain (self-host)"
                      : sitePresenceLabel(h.sitePresence)}
                  </td>
                  <td className="px-4 py-3">
                    {h.hostingMode === "SELF"
                      ? "Always on"
                      : h.listOnMarketplace
                        ? "On"
                        : "Off"}
                  </td>
                  <td className="px-4 py-3">{approvalLabel(h.approvalStatus)}</td>
                  <td className="px-4 py-3">
                    {subscriptionLabel(h.subscriptionStatus)}
                  </td>
                  <td className="px-4 py-3">
                    {h.plan
                      ? `${h.plan.name} (${formatPlanPrice(h.plan, formatMoney)})`
                      : " - "}
                    {h.plan && h.plan.monthlyPrice <= 0 ? (
                      <span className="ml-1 text-xs text-emerald-700">
                        free
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/ops/hosting/${h.id}`}
                      className="font-medium text-bonnet hover:underline"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
