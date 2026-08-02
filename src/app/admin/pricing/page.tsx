import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  hostHasPricingIntelligenceAddon,
  isPricingIntelligenceEnabled,
  pricingAddonStatusLabel,
  PRICING_INTELLIGENCE_ADDON_BLURB,
  PRICING_INTELLIGENCE_ADDON_LABEL,
  PRICING_INTELLIGENCE_ADDON_USD,
} from "@/lib/platform-features";
import {
  cancelPricingIntelligenceAddon,
  requestPricingIntelligenceAddon,
  startPricingResearch,
} from "@/app/actions/pricing-intelligence";
import { Button, Card, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing intelligence · Admin" };

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    started?: string;
    requested?: string;
    cancelled?: string;
  }>;
}) {
  if (!isPricingIntelligenceEnabled()) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="text-2xl font-semibold text-stone-900">
          Pricing intelligence
        </h1>
        <p className="text-sm text-stone-600">
          Market pricing research agents are a{" "}
          <strong>hosted Yall Come Back platform</strong> feature. They are not
          included in the MIT open-source self-host product.
        </p>
      </div>
    );
  }

  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/pricing");
  const sp = await searchParams;

  const hostFilter = access.isPlatform ? {} : { hostId: access.hostId! };

  const hosts = access.isPlatform
    ? await prisma.host.findMany({
        where: { active: true, approvalStatus: "APPROVED" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          pricingIntelligenceAddonStatus: true,
          pricingIntelligenceAddonAmount: true,
        },
        take: 80,
      })
    : [];

  const billingHost =
    !access.isPlatform && access.hostId
      ? await prisma.host.findUnique({
          where: { id: access.hostId },
          select: {
            id: true,
            name: true,
            pricingIntelligenceAddonStatus: true,
            pricingIntelligenceAddonAmount: true,
            pricingIntelligenceAddonStartedAt: true,
          },
        })
      : null;

  const runs = await prisma.pricingIntelligenceRun.findMany({
    where: hostFilter,
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      host: {
        select: {
          name: true,
          slug: true,
          pricingIntelligenceAddonStatus: true,
        },
      },
      _count: { select: { recommendations: true } },
      recommendations: {
        where: { status: "PENDING" },
        select: { id: true },
      },
    },
  });

  const defaultHostId = access.isPlatform
    ? hosts[0]?.id || ""
    : access.hostId || "";

  const hostAddon = billingHost;
  const addonActive = hostAddon
    ? hostHasPricingIntelligenceAddon(hostAddon)
    : false;
  const addonAmount =
    hostAddon?.pricingIntelligenceAddonAmount || PRICING_INTELLIGENCE_ADDON_USD;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pricing intelligence"
        subtitle={`${PRICING_INTELLIGENCE_ADDON_LABEL} — ${formatMoney(PRICING_INTELLIGENCE_ADDON_USD)}/mo optional add-on. Not included in website hosting.`}
      />

      {sp.error === "addon_required" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This tool requires the{" "}
          <strong>
            {formatMoney(PRICING_INTELLIGENCE_ADDON_USD)}/mo pricing intelligence
            add-on
          </strong>
          . It is not part of your hosting fee. Request the add-on below (ops
          activates after payment).
        </p>
      ) : sp.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {decodeURIComponent(sp.error)}
        </p>
      ) : null}
      {sp.requested ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Add-on requested. Platform ops will activate it after payment (
          {formatMoney(addonAmount)}/mo, billed separately from hosting).
        </p>
      ) : null}
      {sp.cancelled ? (
        <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          Pricing intelligence add-on cancelled. You will not be charged going
          forward.
        </p>
      ) : null}

      {/* Subscription / add-on card */}
      {!access.isPlatform && hostAddon ? (
        <Card className="space-y-4 border-honey/40 bg-honey/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-bonnet">
                Optional add-on
              </p>
              <h2 className="mt-1 text-lg font-semibold text-stone-900">
                {PRICING_INTELLIGENCE_ADDON_LABEL}
              </h2>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
                {formatMoney(addonAmount)}
                <span className="text-sm font-medium text-stone-500">
                  /month
                </span>
              </p>
              <p className="mt-2 max-w-xl text-sm text-stone-600">
                {PRICING_INTELLIGENCE_ADDON_BLURB}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700 ring-1 ring-stone-200">
              {pricingAddonStatusLabel(hostAddon.pricingIntelligenceAddonStatus)}
            </span>
          </div>
          <ul className="list-inside list-disc text-sm text-stone-600">
            <li>Monthly capacity-matched market research for your rates</li>
            <li>Human approve before any price change</li>
            <li>
              <strong>Not included</strong> in website hosting or free self-host
            </li>
            <li>Shows as its own line on invoices when active</li>
          </ul>
          {addonActive ? (
            <form action={cancelPricingIntelligenceAddon}>
              <input type="hidden" name="hostId" value={hostAddon.id} />
              <Button type="submit" variant="secondary">
                Cancel add-on
              </Button>
            </form>
          ) : hostAddon.pricingIntelligenceAddonStatus === "REQUESTED" ? (
            <p className="text-sm font-medium text-amber-900">
              Request received — we&apos;ll activate after payment is confirmed.
            </p>
          ) : (
            <form action={requestPricingIntelligenceAddon}>
              <input type="hidden" name="hostId" value={hostAddon.id} />
              <Button type="submit">
                Request add-on · {formatMoney(addonAmount)}/mo
              </Button>
            </form>
          )}
        </Card>
      ) : null}

      {access.isPlatform ? (
        <Card className="space-y-2 p-5 text-sm text-stone-600">
          <p className="font-semibold text-stone-900">
            Platform ops · {formatMoney(PRICING_INTELLIGENCE_ADDON_USD)}/mo add-on
          </p>
          <p>
            Hosts must have add-on status <strong>ACTIVE</strong> to run research
            (unless you check “bypass” for support). Activate under{" "}
            <Link href="/ops/hosting" className="font-semibold text-bonnet hover:underline">
              Ops → Hosting
            </Link>{" "}
            after payment. Amount is{" "}
            <strong>never</strong> included in core hosting plan price — it is a
            separate invoice line.
          </p>
        </Card>
      ) : null}

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-stone-900">
          Run research
        </h2>
        <p className="text-sm text-stone-600">
          Collector pulls bookings + marketplace comps by{" "}
          <strong>guest capacity</strong> (sleeps N). Analyst suggests rate
          moves with guardrails (±15%). Nothing applies until you approve.
        </p>
        <form
          action={startPricingResearch}
          className="flex flex-wrap items-end gap-3"
        >
          {access.isPlatform ? (
            <>
              <label className="text-sm">
                <span className="font-medium text-stone-700">Host brand</span>
                <select
                  name="hostId"
                  defaultValue={defaultHostId}
                  className="mt-1 block min-w-[14rem] rounded-xl border border-stone-300 px-3 py-2"
                  required
                >
                  {hosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                      {h.pricingIntelligenceAddonStatus === "ACTIVE"
                        ? " · add-on active"
                        : " · no add-on"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-600">
                <input type="checkbox" name="bypassAddon" value="1" />
                Bypass add-on check (support only)
              </label>
            </>
          ) : (
            <input type="hidden" name="hostId" value={defaultHostId} />
          )}
          <Button
            type="submit"
            disabled={!access.isPlatform && !addonActive}
          >
            Start research run
          </Button>
        </form>
        {!access.isPlatform && !addonActive ? (
          <p className="text-xs text-stone-500">
            Subscribe to the add-on above before running research.
          </p>
        ) : null}
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-stone-900">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            No runs yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/pricing/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-stone-50"
                >
                  <span>
                    <span className="font-medium text-stone-900">
                      {r.host.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}{" "}
                      UTC · {r.trigger} · {r.status}
                      {r.recommendations.length > 0
                        ? ` · ${r.recommendations.length} pending`
                        : ""}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-bonnet">
                    {r._count.recommendations} suggestions →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
