import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDateUS, formatMoney } from "@/lib/utils";
import { requireHostAdmin } from "@/lib/auth";
import { bookingScopeWhere, propertyScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/ui";
import {
  buildAdminBookingRows,
  directBookingBlockWhere,
  parseBookingsView,
  splitUpcomingPast,
} from "@/lib/admin-bookings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings · Admin" };

function statusClass(status: string): string {
  switch (status) {
    case "COMPLETED":
    case "PAID":
      return "bg-emerald-50 text-emerald-800 ring-emerald-100";
    case "CONFIRMED":
      return "bg-petal text-bonnet ring-petal";
    case "CANCELLED":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    case "PENDING PAYMENT":
    case "PENDING CONFIRMATION":
    case "UNPAID":
      return "bg-amber-50 text-amber-900 ring-amber-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

/** Calendar day in the marketplace's home zone (Texas). */
function todayYmd(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/bookings");
  const view = parseBookingsView((await searchParams)?.view);

  const [bookings, blocks] = await Promise.all([
    prisma.booking.findMany({
      where: bookingScopeWhere(access),
      include: { property: true, payments: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.calendarBlock.findMany({
      where: {
        ...directBookingBlockWhere(),
        property: propertyScopeWhere(access),
      },
      include: { property: { select: { title: true } } },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const rows = buildAdminBookingRows(bookings, blocks);
  const { upcoming, past } = splitUpcomingPast(rows, todayYmd());
  const shown = view === "past" ? past : upcoming;

  const tab = (id: "upcoming" | "past", label: string, n: number) => (
    <Link
      href={id === "past" ? "/admin/bookings?view=past" : "/admin/bookings"}
      aria-current={view === id ? "page" : undefined}
      className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset ${
        view === id
          ? "bg-slate-900 text-white ring-slate-900"
          : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label} ({n})
    </Link>
  );

  return (
    <div>
      <p className="mb-3">
        <Link
          href="/admin"
          className="text-sm font-medium text-bonnet hover:underline"
        >
          ← Dashboard
        </Link>
      </p>
      <PageHeader
        title="Bookings"
        subtitle={`${rows.length} total · online and direct bookings`}
      />

      <nav className="mb-4 flex gap-2" aria-label="Booking views">
        {tab("upcoming", "Upcoming", upcoming.length)}
        {tab("past", "Past", past.length)}
      </nav>

      <div className="space-y-2.5">
        {shown.map((r) => (
          <Link
            key={`${r.kind}-${r.id}`}
            href={r.href}
            className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-semibold text-slate-900">
                  {r.guestName}
                </p>
                <p className="mt-0.5 break-words text-sm text-slate-500">
                  {r.propertyTitle}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {formatDateUS(r.checkIn)} → {formatDateUS(r.checkOut)}
                  {r.guests
                    ? ` · ${r.guests} guest${r.guests === 1 ? "" : "s"}`
                    : ""}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{r.channel}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusClass(r.status)}`}
                >
                  {r.status}
                </span>
                {r.amount != null && r.amount > 0 ? (
                  <p className="text-sm font-medium text-slate-800">
                    {formatMoney(r.amount)}
                  </p>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
        {shown.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
            {view === "past" ? "No past bookings." : "No upcoming bookings."}
          </div>
        )}
      </div>
    </div>
  );
}
