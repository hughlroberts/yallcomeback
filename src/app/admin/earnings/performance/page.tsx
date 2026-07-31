import { redirect } from "next/navigation";
import { EarningsShell } from "@/components/earnings/earnings-shell";
import { PerformanceCharts } from "@/components/earnings/performance-charts";
import { requireHostAdmin } from "@/lib/auth";
import {
  getMonthlyPerformance,
  getPerformanceSummary,
} from "@/lib/earnings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings · Performance" };

export default async function EarningsPerformancePage() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/earnings/performance");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const priorYear = year - 1;

  const [summary, priorBuckets] = await Promise.all([
    getPerformanceSummary(access, year, month),
    getMonthlyPerformance(access, priorYear),
  ]);

  return (
    <EarningsShell active="performance">
      <PerformanceCharts
        year={year}
        priorYear={priorYear}
        current={summary.buckets}
        prior={priorBuckets}
        selectedMonth={month}
        monthPaid={summary.current.paid}
        monthUpcoming={summary.current.upcoming}
        monthTotal={summary.current.total}
      />
    </EarningsShell>
  );
}
