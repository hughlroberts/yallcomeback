import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isPricingIntelligenceEnabled,
  pricingIntelligenceLlmConfigured,
  PRICING_INTELLIGENCE_ADDON_LABEL,
  PRICING_INTELLIGENCE_ADDON_USD,
} from "@/lib/platform-features";
import { isStripeConfigured } from "@/lib/stripe";
import { startPricingResearch } from "@/app/actions/pricing-intelligence";
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
  if (!access) redirect("/login?callbackUrl=/ops");
  const sp = await searchParams;

  // Hosted in Ops for now — not in host Admin.
  if (!access.isPlatform) {
    redirect("/admin");
  }

  const hosts = await prisma.host.findMany({
    where: { active: true, approvalStatus: "APPROVED" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      pricingIntelligenceEnabled: true,
      pricingIntelligenceAddonStatus: true,
      pricingIntelligenceAddonAmount: true,
    },
    take: 80,
  });

  const runs = await prisma.pricingIntelligenceRun.findMany({
    where: {},
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

  const defaultHostId = hosts[0]?.id || "";
  const addonAmount = PRICING_INTELLIGENCE_ADDON_USD;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pricing intelligence"
        subtitle={`${PRICING_INTELLIGENCE_ADDON_LABEL} — ${formatMoney(PRICING_INTELLIGENCE_ADDON_USD)}/mo optional add-on. Not included in website hosting.`}
      />

      {sp.error === "access_off" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Pricing intelligence is not enabled for this brand yet.
        </p>
      ) : sp.error === "addon_required" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This tool requires the paid{" "}
          <strong>
            {formatMoney(PRICING_INTELLIGENCE_ADDON_USD)}/mo add-on
          </strong>
          . It is not part of hosting. Request below; we activate after payment.
        </p>
      ) : sp.error && !String(sp.error).includes("NEXT_REDIRECT") ? (
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

      <Card className="space-y-3 border-stone-300 bg-stone-50 p-5 text-sm text-stone-700">
          <p className="font-semibold text-stone-900">
            Ops controls (secret rollout)
          </p>
          <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed">
            <li>
              <Link
                href="/ops/hosting"
                className="font-semibold text-bonnet hover:underline"
              >
                Ops → Hosting → [host]
              </Link>
              : check <strong>Beta access on</strong> to show this nav for that
              host only.
            </li>
            <li>
              After they pay {formatMoney(PRICING_INTELLIGENCE_ADDON_USD)}/mo,
              set paid status to <strong>Active</strong> (separate invoice line —
              not in hosting plan).
            </li>
            <li>
              Your testing: pick your host below and use{" "}
              <strong>Bypass access / payment</strong> to run without charging
              yourself.
            </li>
          </ol>
          <p className="text-xs text-stone-500">
            Not advertised on marketing pages. Not in open source.
          </p>
        </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-stone-900">
          Run research
        </h2>
        <p className="text-sm text-stone-600">
          Collector pulls bookings + quality-balanced peers (private comps +
          marketplace). Analyst suggests rate moves with guardrails (±15%).
          Nothing applies until you approve.
        </p>
        <ul className="flex flex-wrap gap-2 text-xs">
          <li
            className={
              pricingIntelligenceLlmConfigured()
                ? "rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-900"
                : "rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-950"
            }
          >
            {pricingIntelligenceLlmConfigured()
              ? "XAI/LLM brief: on"
              : "XAI_API_KEY missing on this service — internal comps only"}
          </li>
          <li
            className={
              isStripeConfigured()
                ? "rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-900"
                : "rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600"
            }
          >
            {isStripeConfigured()
              ? "Stripe add-on checkout: on"
              : "Stripe off — request/ops path for $35 add-on"}
          </li>
        </ul>
        <form
          action={startPricingResearch}
          className="flex flex-wrap items-end gap-3"
        >
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
                  {h.pricingIntelligenceEnabled ? " · beta" : " · hidden"}
                  {h.pricingIntelligenceAddonStatus === "ACTIVE"
                    ? " · paid"
                    : " · unpaid"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" name="bypassAddon" value="1" />
            Bypass access / payment (your testing only)
          </label>
          <Button type="submit">Start research run</Button>
        </form>
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
