import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPricingIntelligenceEnabled } from "@/lib/platform-features";
import { startPricingResearch } from "@/app/actions/pricing-intelligence";
import { Button, Card, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing intelligence · Admin" };

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; started?: string }>;
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
        <p className="text-sm text-stone-500">
          On production, set{" "}
          <code className="rounded bg-stone-100 px-1">PLATFORM_PRODUCT_MODE=true</code>{" "}
          (or run as the main product) and ensure{" "}
          <code className="rounded bg-stone-100 px-1">
            PRICING_INTELLIGENCE_ENABLED
          </code>{" "}
          is not false.
        </p>
      </div>
    );
  }

  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/pricing");
  const sp = await searchParams;

  const hostFilter = access.isPlatform
    ? {}
    : { hostId: access.hostId! };

  const hosts = access.isPlatform
    ? await prisma.host.findMany({
        where: { active: true, approvalStatus: "APPROVED" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
        take: 80,
      })
    : [];

  const runs = await prisma.pricingIntelligenceRun.findMany({
    where: hostFilter,
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      host: { select: { name: true, slug: true } },
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pricing intelligence"
        subtitle="Monthly market research for base nightly rates — capacity-matched peers first, human approval before any change. Platform-only (not in open source)."
      />

      {sp.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {decodeURIComponent(sp.error)}
        </p>
      ) : null}

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-stone-900">
          Run research now
        </h2>
        <p className="text-sm text-stone-600">
          Collector pulls your bookings + marketplace comps by{" "}
          <strong>guest capacity</strong> (sleeps N). Analyst suggests rate
          moves with guardrails (±15%). Nothing applies until you approve.
        </p>
        <form action={startPricingResearch} className="flex flex-wrap items-end gap-3">
          {access.isPlatform ? (
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
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="hostId" value={defaultHostId} />
          )}
          <Button type="submit">Start research run</Button>
        </form>
        <p className="text-xs text-stone-500">
          Optional: set{" "}
          <code className="rounded bg-stone-100 px-1">XAI_API_KEY</code> for a
          short external market brief (Airbnb/VRBO-style norms by capacity).
          Schedule monthly:{" "}
          <code className="rounded bg-stone-100 px-1">
            GET /api/cron/pricing-intelligence
          </code>{" "}
          with Bearer CRON_SECRET.
        </p>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-stone-900">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            No runs yet. Start one above after you have published listings.
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

      <Card className="p-5 text-sm text-stone-600">
        <p className="font-semibold text-stone-900">What “good” looks like</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Capacity (house size / sleeps N) is the default comp set</li>
          <li>Agents may flag stronger factors (occupancy, season) explicitly</li>
          <li>Clear do-nothing when data is thin</li>
          <li>Approve → Apply is a deliberate two-step executor</li>
        </ul>
        <p className="mt-3 text-xs text-stone-500">
          Docs:{" "}
          <code className="rounded bg-stone-100 px-1">
            docs/platform-pricing-intelligence.md
          </code>
          . Example suggested rate display uses {formatMoney(150)} style USD.
        </p>
      </Card>
    </div>
  );
}
