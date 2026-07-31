import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { EarningsShell } from "@/components/earnings/earnings-shell";
import { EarningsFilters } from "@/components/earnings/earnings-filters";
import { requireHostAdmin } from "@/lib/auth";
import {
  availableYears,
  getHostListings,
  getPaidEarnings,
} from "@/lib/earnings";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings · Paid" };

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export default async function EarningsPaidPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    listing?: string;
    q?: string;
    method?: string;
  }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/earnings/paid");

  const sp = await searchParams;
  const [listings, rows] = await Promise.all([
    getHostListings(access),
    getPaidEarnings(access, {
      year: sp.year,
      propertyId: sp.listing,
      q: sp.q,
      method: sp.method,
    }),
  ]);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const exportQs = new URLSearchParams();
  if (sp.year) exportQs.set("year", sp.year);
  if (sp.listing) exportQs.set("listing", sp.listing);
  if (sp.q) exportQs.set("q", sp.q);
  if (sp.method) exportQs.set("method", sp.method);
  const exportHref = `/admin/earnings/paid/export${
    exportQs.toString() ? `?${exportQs.toString()}` : ""
  }`;

  return (
    <EarningsShell active="paid">
      <h2 className="text-[28px] font-semibold tracking-tight text-stone-900">
        Paid
      </h2>

      <Suspense fallback={null}>
        <EarningsFilters
          listings={listings}
          years={availableYears()}
          showMethod
        />
      </Suspense>

      {rows.length === 0 ? (
        <div className="mt-20 text-center">
          <p className="text-lg font-semibold text-stone-900">
            No paid transactions
          </p>
          <p className="mt-2 text-sm text-stone-500">
            When guest deposits are marked paid, they appear here.
          </p>
          <Link
            href="/admin/bookings"
            className="mt-6 inline-block text-sm font-semibold text-bonnet underline-offset-2 hover:underline"
          >
            View bookings
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Paid out</th>
                  <th className="px-4 py-3 font-medium">Payout method</th>
                  <th className="px-4 py-3 font-medium">Listing</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50/80"
                  >
                    <td className="px-4 py-3.5">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-stone-700">
                      {fmtDate(r.date)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-stone-900">
                      {formatMoney(r.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-stone-600">
                      {r.methodLabel}
                      <span className="mt-0.5 block text-xs text-stone-400">
                        {r.guestName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-stone-700">
                      {r.propertyTitle}
                    </td>
                    <td className="px-2 py-3.5 text-right">
                      <Link
                        href={`/admin/bookings/${r.bookingId}`}
                        className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                        title="View booking"
                      >
                        1
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold text-stone-900">
              {formatMoney(total)}
            </p>
            <a
              href={exportHref}
              className="inline-flex rounded-[var(--radius-control)] bg-bonnet px-4 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover"
            >
              Export CSV
            </a>
          </div>
        </>
      )}
    </EarningsShell>
  );
}
