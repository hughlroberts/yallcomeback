import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  issueHostingInvoice,
  suspendHost,
  updateHostOps,
} from "@/app/actions/hosting";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  approvalLabel,
  formatPlanPrice,
  hostingModeLabel,
  sitePresenceLabel,
  subscriptionLabel,
} from "@/lib/hosting";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hostId: string }>;
}) {
  const { hostId } = await params;
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { name: true },
  });
  return { title: host ? `${host.name} · Ops hosting` : "Host · Ops" };
}

export default async function OpsHostDetailPage({
  params,
}: {
  params: Promise<{ hostId: string }>;
}) {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/hosting");

  const { hostId } = await params;
  const [host, plans] = await Promise.all([
    prisma.host.findUnique({
      where: { id: hostId },
      include: {
        plan: true,
        users: { orderBy: { createdAt: "asc" } },
        properties: {
          orderBy: { title: "asc" },
          select: {
            id: true,
            title: true,
            slug: true,
            published: true,
            listOnMarketplace: true,
            city: true,
            baseNightlyRate: true,
            _count: { select: { images: true, bookings: true } },
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 12,
          include: { plan: true },
        },
        _count: { select: { properties: true, conversations: true } },
      },
    }),
    prisma.hostingPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  if (!host) notFound();

  const published = host.properties.filter((p) => p.published).length;
  const estimatedBill =
    host.plan && host.plan.monthlyPrice > 0
      ? host.plan.pricingModel === "PER_PROPERTY"
        ? host.plan.monthlyPrice * Math.max(published, host.plan.minProperties)
        : host.plan.monthlyPrice
      : 0;

  const isComplimentary = Boolean(host.plan && host.plan.monthlyPrice <= 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-ink-muted">
          <Link href="/ops/hosting" className="text-bonnet hover:underline">
            ← Website hosting
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {host.name}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              /h/{host.slug}
              {host.websiteUrl
                ? ` · ${host.websiteUrl.replace(/^https?:\/\//i, "")}`
                : ""}
              {" · "}
              {host._count.properties} listing
              {host._count.properties === 1 ? "" : "s"} ({published} published)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-petal px-3 py-1 text-xs font-medium text-bonnet">
              {approvalLabel(host.approvalStatus)}
            </span>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
              {subscriptionLabel(host.subscriptionStatus)}
            </span>
            {isComplimentary ? (
              <span className="rounded-full bg-sage/30 px-3 py-1 text-xs font-medium text-sage-ink">
                Complimentary · not billed
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-muted">Published listings</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{published}</p>
          <p className="mt-1 text-xs text-ink-muted">
            Billable units on per-property plans
          </p>
        </Card>
        <Card>
          <p className="text-sm text-ink-muted">Estimated monthly</p>
          <p className="mt-1 text-3xl font-semibold text-ink">
            {formatMoney(estimatedBill)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {host.plan
              ? `${host.plan.name} · ${formatPlanPrice(host.plan, formatMoney)}`
              : "No plan"}
            {isComplimentary ? " · $0 always" : ""}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-ink-muted">Mode</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {hostingModeLabel(host.hostingMode)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {sitePresenceLabel(host.sitePresence)} · marketplace{" "}
            {host.listOnMarketplace ? "on" : "off"}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Edit host</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Use <strong>Complimentary</strong> for your own brand (any number of
          listings, never billed). Paying customers get Listing hosting at
          $40/published listing.
        </p>
        <form action={updateHostOps} className="mt-6 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="hostId" value={host.id} />
          <div>
            <Label htmlFor="name">Brand name</Label>
            <Input id="name" name="name" defaultValue={host.name} required />
          </div>
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              name="tagline"
              defaultValue={host.tagline || ""}
            />
          </div>
          <div>
            <Label htmlFor="websiteUrl">Website / domain</Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              defaultValue={host.websiteUrl || ""}
              placeholder="https://cherokeelanding.net"
            />
          </div>
          <div>
            <Label htmlFor="sitePresence">Guest site presence</Label>
            <select
              id="sitePresence"
              name="sitePresence"
              defaultValue={host.sitePresence}
              className="mt-1 h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-white px-3 text-sm"
            >
              <option value="STAYLOCAL">Yall Come Back URLs only</option>
              <option value="CUSTOM">Own domain only</option>
              <option value="BOTH">Both domain + platform</option>
            </select>
          </div>
          <div>
            <Label htmlFor="hostingMode">Hosting mode</Label>
            <select
              id="hostingMode"
              name="hostingMode"
              defaultValue={host.hostingMode}
              className="mt-1 h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-white px-3 text-sm"
            >
              <option value="PLATFORM">
                Platform-hosted (on this Railway app)
              </option>
              <option value="SELF">Self-hosted (their own stack)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="planId">Hosting plan</Label>
            <select
              id="planId"
              name="planId"
              defaultValue={host.planId || ""}
              className="mt-1 h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-white px-3 text-sm"
            >
              <option value="">— None —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatPlanPrice(p, formatMoney)}
                  {p.monthlyPrice <= 0
                    ? " (platform / partners only · never billed)"
                    : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="subscriptionStatus">Subscription status</Label>
            <select
              id="subscriptionStatus"
              name="subscriptionStatus"
              defaultValue={host.subscriptionStatus}
              className="mt-1 h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-white px-3 text-sm"
            >
              <option value="NONE">None</option>
              <option value="PENDING_PAYMENT">Pending payment</option>
              <option value="ACTIVE">Active</option>
              <option value="PAST_DUE">Past due</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <Label htmlFor="billingEmail">Billing email</Label>
            <Input
              id="billingEmail"
              name="billingEmail"
              type="email"
              defaultValue={host.billingEmail || ""}
            />
          </div>
          <div>
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={host.contactEmail || ""}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="approvalNotes">Internal notes</Label>
            <Textarea
              id="approvalNotes"
              name="approvalNotes"
              rows={2}
              defaultValue={host.approvalNotes || ""}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="listOnMarketplace"
              defaultChecked={host.listOnMarketplace}
              className="rounded"
            />
            List on marketplace
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={host.active}
              className="rounded"
            />
            Active
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Listings</h2>
            <p className="text-sm text-ink-muted">
              Multiple properties under one brand share one plan. Per-property
              plans bill × published count (Complimentary stays $0).
            </p>
          </div>
          <Link
            href="/admin/properties"
            className="text-sm font-medium text-bonnet hover:underline"
          >
            Open properties admin →
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-hairline">
          {host.properties.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <div>
                <Link
                  href={`/admin/properties/${p.id}`}
                  className="font-medium text-ink hover:text-bonnet"
                >
                  {p.title}
                </Link>
                <p className="text-xs text-ink-muted">
                  {p.city || "—"} · {formatMoney(p.baseNightlyRate)}/night ·{" "}
                  {p._count.images} photos · {p._count.bookings} bookings
                </p>
              </div>
              <div className="flex gap-2">
                {p.published ? (
                  <span className="rounded-full bg-sage/25 px-2.5 py-0.5 text-xs text-sage-ink">
                    Published
                  </span>
                ) : (
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">
                    Draft
                  </span>
                )}
                {p.listOnMarketplace ? (
                  <span className="rounded-full bg-petal px-2.5 py-0.5 text-xs text-bonnet">
                    Marketplace
                  </span>
                ) : null}
              </div>
            </li>
          ))}
          {host.properties.length === 0 ? (
            <li className="py-4 text-sm text-ink-muted">No listings yet.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Users on this brand</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {host.users.map((u) => (
            <li key={u.id}>
              <span className="font-medium">{u.name || "—"}</span>{" "}
              <span className="text-ink-muted">
                {u.email} · {u.role}
              </span>
            </li>
          ))}
          {host.users.length === 0 ? (
            <li className="text-ink-muted">No host users linked.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Hosting invoices</h2>
          {!isComplimentary && host.hostingMode === "PLATFORM" ? (
            <form action={issueHostingInvoice}>
              <input type="hidden" name="hostId" value={host.id} />
              <input type="hidden" name="planId" value={host.planId || ""} />
              <Button type="submit" variant="secondary">
                Issue invoice
              </Button>
            </form>
          ) : (
            <p className="text-xs text-ink-muted">
              Complimentary / self-host — no invoices
            </p>
          )}
        </div>
        <ul className="mt-4 divide-y divide-hairline text-sm">
          {host.invoices.map((inv) => (
            <li key={inv.id} className="flex justify-between gap-3 py-2">
              <span>
                {formatMoney(inv.amount)} · {inv.status}
                {inv.propertyCount
                  ? ` · ${inv.propertyCount} properties`
                  : ""}
              </span>
              <span className="text-ink-muted">
                {inv.periodStart.toISOString().slice(0, 10)} →{" "}
                {inv.periodEnd.toISOString().slice(0, 10)}
              </span>
            </li>
          ))}
          {host.invoices.length === 0 ? (
            <li className="py-2 text-ink-muted">No invoices yet.</li>
          ) : null}
        </ul>
      </Card>

      <form action={suspendHost} className="flex justify-end">
        <input type="hidden" name="hostId" value={host.id} />
        <Button type="submit" variant="danger">
          Suspend host
        </Button>
      </form>
    </div>
  );
}
