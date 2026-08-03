import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import {
  setPricingMarketCompActive,
  upsertPricingMarketComp,
} from "@/app/actions/pricing-comps";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing comps · Ops" };

/**
 * Private PricingMarketComp rows — never guest-facing.
 * Used only by pricing intelligence agents.
 */
export default async function OpsPricingCompsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const comps = await prisma.pricingMarketComp.findMany({
    orderBy: [{ active: "desc" }, { region: "asc" }, { city: "asc" }, { title: "asc" }],
  });
  const active = comps.filter((c) => c.active).length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Platform only
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-stone-900">
          Pricing market comps
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Private proxy listings for the pricing agents.{" "}
          <strong>Not</strong> on the marketplace, not bookable, not shown to
          guests. Seed area rates here so research has peers before inventory is
          deep.
        </p>
        <p className="mt-2 text-sm text-stone-500">
          {active} active · {comps.length} total ·{" "}
          <Link href="/admin/pricing" className="font-medium text-bonnet hover:underline">
            Pricing intelligence →
          </Link>
        </p>
      </div>

      {sp.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Comp saved.
        </p>
      ) : null}
      {sp.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {decodeURIComponent(sp.error)}
        </p>
      ) : null}

      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Key / title</th>
                <th className="px-4 py-3">Place</th>
                <th className="px-4 py-3">Sleeps</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {comps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                    No private comps yet. Add one below or run{" "}
                    <code className="rounded bg-stone-100 px-1 text-xs">
                      scripts/migrate-pricing-comps-private.ts
                    </code>
                    .
                  </td>
                </tr>
              ) : null}
              {comps.map((c) => (
                <tr key={c.id} className="border-b border-stone-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-900">{c.title}</p>
                    <p className="font-mono text-[11px] text-stone-400">{c.key}</p>
                    {c.sourceNote ? (
                      <p className="mt-0.5 text-xs text-stone-400">{c.sourceNote}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {[c.city, c.region].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-stone-700">
                    {c.maxGuests}
                    <span className="text-stone-400">
                      {" "}
                      · {c.bedrooms} br
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-stone-900">
                    {formatMoney(c.baseNightlyRate)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        c.active
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                          : "rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-500"
                      }
                    >
                      {c.active ? "Active" : "Off"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={setPricingMarketCompActive} className="inline">
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={c.active ? "0" : "1"}
                      />
                      <button
                        type="submit"
                        className="text-xs font-medium text-bonnet hover:underline"
                      >
                        {c.active ? "Turn off" : "Turn on"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-stone-900">
          Add / update private comp
        </h2>
        <p className="text-sm text-stone-500">
          Same <code className="rounded bg-stone-100 px-1 text-xs">key</code>{" "}
          updates an existing row. Use amenity tokens like{" "}
          <code className="rounded bg-stone-100 px-1 text-xs">waterfront</code>,{" "}
          <code className="rounded bg-stone-100 px-1 text-xs">private_dock</code>,{" "}
          <code className="rounded bg-stone-100 px-1 text-xs">pool</code> for
          matching.
        </p>
        <form action={upsertPricingMarketComp} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600" htmlFor="key">
              Key (unique)
            </label>
            <input
              id="key"
              name="key"
              required
              placeholder="ccl-waterfront-dock-8"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder="Lakefront cottage with dock"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600" htmlFor="city">
              City
            </label>
            <input
              id="city"
              name="city"
              placeholder="Log Cabin"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600" htmlFor="region">
              Region / state
            </label>
            <input
              id="region"
              name="region"
              placeholder="Texas"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600" htmlFor="maxGuests">
              Max guests
            </label>
            <input
              id="maxGuests"
              name="maxGuests"
              type="number"
              min={1}
              max={40}
              defaultValue={8}
              required
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600" htmlFor="bedrooms">
              Bedrooms
            </label>
            <input
              id="bedrooms"
              name="bedrooms"
              type="number"
              min={0}
              max={20}
              defaultValue={2}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-stone-600"
              htmlFor="baseNightlyRate"
            >
              Nightly rate ($)
            </label>
            <input
              id="baseNightlyRate"
              name="baseNightlyRate"
              type="number"
              min={1}
              step="0.01"
              required
              placeholder="285"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-stone-600"
              htmlFor="amenities"
            >
              Amenities (comma-separated)
            </label>
            <input
              id="amenities"
              name="amenities"
              placeholder="waterfront, private_dock, lake_view"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label
              className="text-xs font-medium text-stone-600"
              htmlFor="description"
            >
              Description (for matching keywords)
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Private dock, sandy bottom, open water view…"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save private comp</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
