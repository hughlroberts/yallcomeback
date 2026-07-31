import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";
import { redirect } from "next/navigation";
import { SleepingArrangementsDisplay } from "@/components/sleeping-arrangements-display";

export const dynamic = "force-dynamic";
export const metadata = { title: "My bookings" };

export default async function MyBookingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { guestEmail: session.user.email },
      ],
    },
    include: { property: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">My bookings</h1>
        <Link
          href="/account/settings/personal"
          className="text-sm font-medium text-bonnet hover:underline"
        >
          Account settings
        </Link>
      </div>
      <div className="mt-8 space-y-4">
        {bookings.length === 0 && (
          <p className="text-stone-500">
            No bookings yet.{" "}
            <Link href="/properties" className="text-bonnet">
              Browse properties
            </Link>
          </p>
        )}
        {bookings.map((b) => (
          <div
            key={b.id}
            className="rounded-xl border border-stone-200 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/properties/${b.property.slug}`}
                  className="font-semibold text-stone-900 hover:underline"
                >
                  {b.property.title}
                </Link>
                <p className="mt-1 text-sm text-stone-500">
                  {b.checkIn.toISOString().slice(0, 10)} →{" "}
                  {b.checkOut.toISOString().slice(0, 10)} · {b.guests} guests
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-stone-600">
                {b.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-3 text-sm text-stone-600">
              Total {formatMoney(b.totalAmount)} · Deposit{" "}
              {formatMoney(b.depositAmount)}
            </p>
            <div className="mt-3 rounded-lg border border-stone-100 bg-stone-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Room setup
              </p>
              <div className="mt-1.5">
                <SleepingArrangementsDisplay
                  rawJson={b.property.sleepingArrangements}
                  bedrooms={b.property.bedrooms}
                  beds={b.property.beds}
                  compact
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
