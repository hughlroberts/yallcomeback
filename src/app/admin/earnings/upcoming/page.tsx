import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { EarningsShell } from "@/components/earnings/earnings-shell";
import { EarningsFilters } from "@/components/earnings/earnings-filters";
import { requireHostAdmin } from "@/lib/auth";
import {
  availableYears,
  getHostListings,
  getUpcomingEarnings,
} from "@/lib/earnings";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings · Upcoming" };

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export default async function EarningsUpcomingPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    listing?: string;
    q?: string;
    type?: string;
  }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/earnings/upcoming");

  const sp = await searchParams;
  const [listings, rows] = await Promise.all([
    getHostListings(access),
    getUpcomingEarnings(access, {
      year: sp.year,
      propertyId: sp.listing,
      q: sp.q,
    }),
  ]);

  let filtered = rows;
  if (sp.type === "deposit") {
    filtered = rows.filter(
      (r) => r.type === "Pending deposit" || r.type === "Deposit",
    );
  } else if (sp.type === "balance") {
    filtered = rows.filter((r) => r.type === "Stay balance");
  }

  const total = filtered.reduce((s, r) => s + r.amount, 0);

  return (
    <EarningsShell active="upcoming">
      <h2 className="text-[28px] font-semibold tracking-tight text-stone-900">
        Upcoming
      </h2>

      <Suspense fallback={null}>
        <EarningsFilters listings={listings} years={availableYears()} />
      </Suspense>

      {filtered.length === 0 ? (
        <div className="mt-20 flex flex-col items-center justify-center px-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-stone-100 shadow-inner ring-1 ring-stone-200">
            <CalendarDays
              className="size-8 text-blue-500"
              strokeWidth={1.5}
            />
          </div>
          <p className="mt-6 text-lg font-semibold text-stone-900">
            No upcoming transactions
          </p>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            You have no upcoming reservations with expected deposits or balances
            at the moment.
          </p>
          <Link
            href="/admin/bookings"
            className="mt-6 text-sm font-semibold text-bonnet underline-offset-2 hover:underline"
          >
            View bookings
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Expected</th>
                  <th className="px-4 py-3 font-medium">Listing</th>
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50/80"
                  >
                    <td className="px-4 py-3.5 font-medium text-stone-900">
                      {r.type}
                    </td>
                    <td className="px-4 py-3.5 text-stone-600">
                      {fmtDate(r.expectedDate)}
                      <span className="mt-0.5 block text-xs text-stone-400">
                        Stay {fmtDate(r.checkIn)} – {fmtDate(r.checkOut)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-stone-700">
                      <Link
                        href={`/admin/properties/${r.propertyId}`}
                        className="hover:underline"
                      >
                        {r.propertyTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-stone-600">{r.guestName}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-stone-900">
                      {formatMoney(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-base font-semibold text-stone-900">
              {formatMoney(total)}
              <span className="ml-2 text-sm font-normal text-stone-500">
                expected
              </span>
            </p>
          </div>
        </>
      )}
    </EarningsShell>
  );
}
