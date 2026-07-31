import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { KpiCard, PageHeader } from "@/components/ui";
import { requireHostAdmin } from "@/lib/auth";
import {
  bookingScopeWhere,
  propertyScopeWhere,
} from "@/lib/scope";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

/**
 * Large profile circle ~ card row height.
 * Gray empty circle when no image (guests rarely have avatars yet).
 */
function ProfileCircle({
  src,
  alt = "",
}: {
  src?: string | null;
  alt?: string;
}) {
  return (
    <span
      className="relative size-[4.25rem] shrink-0 overflow-hidden rounded-full bg-slate-200 ring-1 ring-inset ring-slate-200/80 sm:size-[4.5rem]"
      aria-hidden={!src}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="72px"
        />
      ) : null}
    </span>
  );
}

/** Soft status pills — ClaimSight language. */
function bookingStatusClass(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100";
    case "CONFIRMED":
      return "bg-petal text-bonnet ring-1 ring-inset ring-petal";
    case "CANCELLED":
      return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 line-through decoration-slate-400";
    case "PENDING_PAYMENT":
    case "PENDING_CONFIRMATION":
      return "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-100";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200";
  }
}

function bookingAccentClass(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "border-l-emerald-500";
    case "CONFIRMED":
      return "border-l-blue-500";
    case "CANCELLED":
      return "border-l-slate-300";
    case "PENDING_PAYMENT":
    case "PENDING_CONFIRMATION":
      return "border-l-amber-500";
    default:
      return "border-l-slate-300";
  }
}

function blockSourceClass(source: string): string {
  switch (source) {
    case "BOOKING":
      return "bg-petal text-bonnet ring-1 ring-inset ring-petal";
    case "MANUAL":
      return "bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-100";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200";
  }
}

function blockAccentClass(source: string, blockType: string | null): string {
  const type = (blockType || "").toUpperCase();
  if (type.includes("MAINTENANCE")) return "border-l-orange-500";
  if (source === "BOOKING") return "border-l-blue-500";
  if (source === "MANUAL") return "border-l-violet-400";
  return "border-l-slate-300";
}

export default async function AdminDashboard() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin");

  const propWhere = propertyScopeWhere(access);
  const bookWhere = bookingScopeWhere(access);

  const [propertyCount, pendingBookings, upcomingBlocks, recentBookings, host] =
    await Promise.all([
      prisma.property.count({ where: propWhere }),
      prisma.booking.count({
        where: { status: "PENDING_PAYMENT", ...bookWhere },
      }),
      prisma.calendarBlock.findMany({
        where: {
          startDate: { gte: new Date() },
          source: { in: ["MANUAL", "BOOKING"] },
          ...(access.isPlatform
            ? {}
            : { property: { hostId: access.hostId! } }),
        },
        include: { property: true },
        orderBy: { startDate: "asc" },
        take: 8,
      }),
      prisma.booking.findMany({
        where: bookWhere,
        include: { property: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      access.hostId
        ? prisma.host.findUnique({ where: { id: access.hostId } })
        : null,
    ]);

  const subtitleParts: string[] = [];
  if (host) {
    subtitleParts.push(host.name);
    if (host.hostingMode === "SELF") {
      subtitleParts.push("free self-host · marketplace always on");
    } else if (host.listOnMarketplace) {
      subtitleParts.push("marketplace on");
    } else {
      subtitleParts.push("marketplace off");
    }
  }

  return (
    <div>
      <PageHeader
        title={access.isPlatform ? "Platform dashboard" : "Host dashboard"}
        subtitle={
          host ? (
            <>
              {subtitleParts.join(" · ")}
              {" · "}
              <a
                href={`/marketplace?q=${encodeURIComponent(host.name)}`}
                className="text-bonnet hover:underline"
              >
                View stays
              </a>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Properties" value={propertyCount} />
        <KpiCard
          label="Pending deposits"
          value={pendingBookings}
          hint={
            pendingBookings > 0 ? "Need action soon" : "All clear"
          }
        />
        <KpiCard
          label="Upcoming calendar items"
          value={upcomingBlocks.length}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent bookings
            </h2>
            <Link
              href="/admin/bookings"
              className="text-sm font-medium text-bonnet hover:text-bonnet"
            >
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {recentBookings.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/admin/bookings/${b.id}`}
                  className={`block border-l-4 bg-white px-4 py-3 transition hover:bg-slate-50/80 ${bookingAccentClass(b.status)}`}
                >
                  <div className="flex items-center gap-3.5">
                    <ProfileCircle
                      src={null}
                      alt=""
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-medium text-slate-900">
                          {b.guestName}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${bookingStatusClass(b.status)}`}
                        >
                          {b.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500">
                        <span className="text-slate-700">{b.property.title}</span>
                        <span className="mx-1.5 text-slate-300" aria-hidden>
                          ·
                        </span>
                        {formatMoney(b.depositAmount)} deposit
                        {b.sourceChannel ? (
                          <>
                            <span className="mx-1.5 text-slate-300" aria-hidden>
                              ·
                            </span>
                            <span className="text-slate-500">
                              via {b.sourceChannel.replaceAll("_", " ")}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {recentBookings.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                No bookings yet.
              </li>
            )}
          </ul>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Upcoming stays / blocks
            </h2>
          </div>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {upcomingBlocks.map((b) => {
              const href = b.bookingId
                ? `/admin/bookings/${b.bookingId}`
                : `/admin/properties/${b.propertyId}?tab=blocks`;
              return (
                <li key={b.id}>
                  <Link
                    href={href}
                    className={`block border-l-4 bg-white px-4 py-3 transition hover:bg-slate-50/80 ${blockAccentClass(b.source, b.blockType)}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <ProfileCircle src={null} alt="" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-medium text-slate-900">
                            {b.occupantName || b.blockType || b.source}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${blockSourceClass(b.source)}`}
                          >
                            {b.source}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500">
                          <span className="text-slate-700">
                            {b.property.title}
                          </span>
                          <span className="mx-1.5 text-slate-300" aria-hidden>
                            ·
                          </span>
                          {b.startDate.toISOString().slice(0, 10)} →{" "}
                          {b.endDate.toISOString().slice(0, 10)}
                        </p>
                        {b.notes ? (
                          <p className="mt-1 line-clamp-1 text-sm text-slate-400">
                            {b.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
            {upcomingBlocks.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                Calendar is clear.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
