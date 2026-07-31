import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { requireHostAdmin } from "@/lib/auth";
import { bookingScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings · Admin" };

function statusClass(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-800 ring-emerald-100";
    case "CONFIRMED":
      return "bg-petal text-bonnet ring-petal";
    case "CANCELLED":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    case "PENDING_PAYMENT":
    case "PENDING_CONFIRMATION":
      return "bg-amber-50 text-amber-900 ring-amber-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export default async function AdminBookingsPage() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/bookings");

  const bookings = await prisma.booking.findMany({
    where: bookingScopeWhere(access),
    include: { property: true, payments: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle={`${bookings.length} total · most recent first`}
      />

      <div className="space-y-2.5">
        {bookings.map((b) => (
          <Link
            key={b.id}
            href={`/admin/bookings/${b.id}`}
            className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{b.guestName}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {b.property.title} · {b.checkIn.toISOString().slice(0, 10)} →{" "}
                  {b.checkOut.toISOString().slice(0, 10)}
                  {b.sourceChannel ? ` · ${b.sourceChannel}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusClass(b.status)}`}
                >
                  {b.status.replaceAll("_", " ")}
                </span>
                <p className="text-sm font-medium text-slate-800">
                  Deposit {formatMoney(b.depositAmount)}
                </p>
              </div>
            </div>
          </Link>
        ))}
        {bookings.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
            No bookings yet.
          </div>
        )}
      </div>
    </div>
  );
}
