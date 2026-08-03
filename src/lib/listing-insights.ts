/**
 * Host listing Insights (Airbnb-style views / bookings / booking rate).
 */

import { prisma } from "@/lib/db";

export type InsightsListingOption = {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  published: boolean;
};

export type InsightsDayPoint = {
  /** YYYY-MM-DD */
  day: string;
  views: number;
  label: string;
};

export type ListingInsights = {
  propertyIds: string[];
  listings: InsightsListingOption[];
  /** Inclusive range */
  rangeStart: string;
  rangeEnd: string;
  days: number;
  views: number;
  newBookings: number;
  /** newBookings / views * 100, or 0 if no views */
  bookingRatePercent: number;
  series: InsightsDayPoint[];
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function formatDayLabel(ymd: string): string {
  const [y, m, day] = ymd.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Host's listings for the Insights multi-select. */
export async function listHostInsightsOptions(
  hostId: string,
): Promise<InsightsListingOption[]> {
  const rows = await prisma.property.findMany({
    where: { hostId },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      slug: true,
      published: true,
      images: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        take: 1,
        select: { url: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    published: r.published,
    imageUrl: r.images[0]?.url ?? null,
  }));
}

/**
 * Aggregate views + bookings for one or more properties over the last `days` days
 * (including today UTC).
 */
export async function getListingInsights(
  propertyIds: string[],
  days = 30,
): Promise<ListingInsights> {
  const ids = [...new Set(propertyIds.filter(Boolean))];
  const dayCount = Math.min(90, Math.max(7, Math.floor(days)));

  const end = startOfUtcDay(new Date());
  const start = addUtcDays(end, -(dayCount - 1));

  const listings =
    ids.length === 0
      ? []
      : await prisma.property.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            title: true,
            slug: true,
            published: true,
            images: {
              orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
              take: 1,
              select: { url: true },
            },
          },
        });

  const options: InsightsListingOption[] = listings.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    published: r.published,
    imageUrl: r.images[0]?.url ?? null,
  }));

  // Full day series (zeros filled)
  const series: InsightsDayPoint[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = addUtcDays(start, i);
    const key = ymdUtc(d);
    series.push({ day: key, views: 0, label: formatDayLabel(key) });
  }
  const byDay = new Map(series.map((s) => [s.day, s]));

  let views = 0;
  let newBookings = 0;

  if (ids.length > 0) {
    const viewRows = await prisma.propertyViewDay.findMany({
      where: {
        propertyId: { in: ids },
        day: { gte: start, lte: end },
      },
      select: { day: true, views: true },
    });
    for (const row of viewRows) {
      const key = ymdUtc(row.day);
      const pt = byDay.get(key);
      if (pt) {
        pt.views += row.views;
        views += row.views;
      }
    }

    // Bookings created in the window (not check-in date)
    newBookings = await prisma.booking.count({
      where: {
        propertyId: { in: ids },
        createdAt: {
          gte: start,
          lt: addUtcDays(end, 1),
        },
        status: {
          in: ["CONFIRMED", "PENDING_PAYMENT", "COMPLETED"],
        },
      },
    });
  }

  const bookingRatePercent =
    views > 0 ? Math.round((newBookings / views) * 1000) / 10 : 0;

  return {
    propertyIds: ids,
    listings: options,
    rangeStart: ymdUtc(start),
    rangeEnd: ymdUtc(end),
    days: dayCount,
    views,
    newBookings,
    bookingRatePercent,
    series,
  };
}

/** Increment today's view count for a published listing (public). */
export async function recordPropertyView(propertyId: string): Promise<void> {
  const day = startOfUtcDay(new Date());
  await prisma.propertyViewDay.upsert({
    where: {
      propertyId_day: { propertyId, day },
    },
    create: {
      propertyId,
      day,
      views: 1,
    },
    update: {
      views: { increment: 1 },
    },
  });
}
