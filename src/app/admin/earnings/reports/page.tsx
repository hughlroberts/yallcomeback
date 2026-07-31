import Link from "next/link";
import { redirect } from "next/navigation";
import { EarningsShell } from "@/components/earnings/earnings-shell";
import { requireHostAdmin } from "@/lib/auth";
import {
  availableYears,
  getMonthlyPerformance,
  getPaidEarnings,
  getUpcomingEarnings,
  MONTH_LABELS,
} from "@/lib/earnings";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings · Reports" };

export default async function EarningsReportsPage() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/earnings/reports");

  const year = new Date().getFullYear();
  const [buckets, paid, upcoming] = await Promise.all([
    getMonthlyPerformance(access, year),
    getPaidEarnings(access, { year: String(year) }),
    getUpcomingEarnings(access),
  ]);

  const yearPaid = buckets.reduce((s, b) => s + b.paid, 0);
  const yearUpcoming = buckets.reduce((s, b) => s + b.upcoming, 0);
  const paidCount = paid.length;
  const avgPayout = paidCount > 0 ? yearPaid / paidCount : 0;

  return (
    <EarningsShell active="reports">
      <h2 className="text-[28px] font-semibold tracking-tight text-stone-900">
        Reports
      </h2>
      <p className="mt-2 text-sm text-stone-500">
        Snapshot of host earnings for {year}. Export detailed paid rows from the
        Paid tab.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Paid YTD", value: formatMoney(yearPaid) },
          { label: "Upcoming", value: formatMoney(yearUpcoming) },
          { label: "Paid transactions", value: String(paidCount) },
          { label: "Avg paid amount", value: formatMoney(avgPayout) },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-stone-500">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-stone-900">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 overflow-x-auto rounded-2xl border border-stone-200">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
              <th className="px-4 py-3 font-medium">Month</th>
              <th className="px-4 py-3 font-medium text-right">Paid</th>
              <th className="px-4 py-3 font-medium text-right">Upcoming</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr
                key={b.month}
                className="border-b border-stone-100 last:border-0"
              >
                <td className="px-4 py-3 font-medium text-stone-900">
                  {MONTH_LABELS[b.month]} {year}
                </td>
                <td className="px-4 py-3 text-right text-stone-700">
                  {formatMoney(b.paid)}
                </td>
                <td className="px-4 py-3 text-right text-stone-700">
                  {formatMoney(b.upcoming)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-stone-900">
                  {formatMoney(b.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-stone-50 font-semibold text-stone-900">
              <td className="px-4 py-3">Year total</td>
              <td className="px-4 py-3 text-right">{formatMoney(yearPaid)}</td>
              <td className="px-4 py-3 text-right">
                {formatMoney(yearUpcoming)}
              </td>
              <td className="px-4 py-3 text-right">
                {formatMoney(yearPaid + yearUpcoming)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/earnings/paid"
          className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50"
        >
          Open Paid
        </Link>
        <Link
          href="/admin/earnings/paid/export"
          className="rounded-[var(--radius-control)] bg-bonnet px-4 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover"
        >
          Export paid CSV ({availableYears()[0]})
        </Link>
        <Link
          href="/admin/earnings/upcoming"
          className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50"
        >
          Upcoming ({upcoming.length})
        </Link>
      </div>
    </EarningsShell>
  );
}
