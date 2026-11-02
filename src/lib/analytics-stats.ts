import { prisma } from "@/lib/db";
import { ANALYTICS_EVENT_NAMES } from "@/lib/analytics-visitor";
import { parseExcludedEmails } from "@/lib/analytics-internal";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NONE = "(none)";
const DIRECT = "(direct)";

export function parseStatsRange(
  fromRaw: string | null,
  toRaw: string | null,
): { from: string; to: string; start: Date; endExclusive: Date } | { error: string } {
  const from = fromRaw?.trim() || "";
  const to = toRaw?.trim() || "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return { error: "from and to must be YYYY-MM-DD" };
  }
  if (from > to) return { error: "from must be on or before to" };
  const start = new Date(`${from}T00:00:00.000Z`);
  const endExclusive = new Date(`${to}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const days =
    (endExclusive.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (days > 366) return { error: "range cannot exceed 366 days" };
  return { from, to, start, endExclusive };
}

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 10000) / 10000;
}

function bump(
  map: Record<string, number>,
  key: string,
  n = 1,
): void {
  map[key] = (map[key] || 0) + n;
}

/**
 * Accounts and bookings to leave out: users with isInternal, users whose
 * email is in ANALYTICS_EXCLUDE_EMAILS, and bookings made by them (or by a
 * guest email on that list, or by a platform admin).
 */
export async function internalExclusions(bookingIds: string[]): Promise<{
  userIds: Set<string>;
  bookingIds: Set<string>;
}> {
  const emails = parseExcludedEmails();
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { isInternal: true },
        ...emails.map((e) => ({
          email: { equals: e, mode: "insensitive" as const },
        })),
      ],
    },
    select: { id: true },
  });
  const userIds = new Set(users.map((u) => u.id));

  const ids = [...new Set(bookingIds)];
  if (ids.length === 0) return { userIds, bookingIds: new Set() };
  const bookings = await prisma.booking.findMany({
    where: {
      id: { in: ids },
      OR: [
        ...(userIds.size ? [{ userId: { in: [...userIds] } }] : []),
        { user: { role: "ADMIN" as const } },
        ...emails.map((e) => ({
          guestEmail: { equals: e, mode: "insensitive" as const },
        })),
      ],
    },
    select: { id: true },
  });
  return { userIds, bookingIds: new Set(bookings.map((b) => b.id)) };
}

export async function buildAnalyticsStats(
  from: string | null,
  to: string | null,
) {
  const range = parseStatsRange(from, to);
  if ("error" in range) return range;

  const whereTime = { createdAt: { gte: range.start, lt: range.endExclusive } };

  const [views, rawEvents] = await Promise.all([
    prisma.pageView.findMany({
      where: whereTime,
      select: {
        createdAt: true,
        path: true,
        referrer: true,
        utmSource: true,
        visitorId: true,
      },
    }),
    prisma.analyticsEvent.findMany({
      where: whereTime,
      select: {
        name: true,
        utmSource: true,
        value: true,
        createdAt: true,
        bookingId: true,
        userId: true,
      },
    }),
  ]);

  const exclude = await internalExclusions(
    rawEvents.map((e) => e.bookingId).filter((id): id is string => Boolean(id)),
  );
  const events = rawEvents.filter(
    (ev) =>
      !(ev.userId && exclude.userIds.has(ev.userId)) &&
      !(ev.bookingId && exclude.bookingIds.has(ev.bookingId)),
  );

  const dailyMap = new Map<
    string,
    {
      visitors: Set<string>;
      pageViews: number;
      guestSignups: number;
      hostSignups: number;
    }
  >();
  for (
    let t = range.start.getTime();
    t < range.endExclusive.getTime();
    t += 86400000
  ) {
    dailyMap.set(utcDay(new Date(t)), {
      visitors: new Set(),
      pageViews: 0,
      guestSignups: 0,
      hostSignups: 0,
    });
  }

  const pages = new Map<string, { views: number; visitors: Set<string> }>();
  const referrers: Record<string, number> = {};
  const utmViews: Record<string, { views: number; visitors: Set<string> }> = {};

  for (const row of views) {
    const day = utcDay(row.createdAt);
    const bucket = dailyMap.get(day);
    if (bucket) {
      bucket.pageViews += 1;
      bucket.visitors.add(row.visitorId);
    }
    const page = pages.get(row.path) || { views: 0, visitors: new Set() };
    page.views += 1;
    page.visitors.add(row.visitorId);
    pages.set(row.path, page);

    bump(referrers, row.referrer || DIRECT);

    const src = row.utmSource || NONE;
    const u = utmViews[src] || { views: 0, visitors: new Set() };
    u.views += 1;
    u.visitors.add(row.visitorId);
    utmViews[src] = u;
  }

  const funnelCounts: Record<string, number> = {};
  const funnelByUtm: Record<string, Record<string, number>> = {};
  for (const name of ANALYTICS_EVENT_NAMES) {
    funnelCounts[name] = 0;
    funnelByUtm[name] = {};
  }

  let bookingRevenue = 0;
  const bookingsByUtm: Record<string, { count: number; revenue: number }> = {};
  const hostSignupsByUtm: Record<string, number> = {};
  const guestSignupsByUtm: Record<string, number> = {};

  for (const ev of events) {
    if (!(ev.name in funnelCounts)) continue;
    funnelCounts[ev.name] += 1;
    const src = ev.utmSource || NONE;
    bump(funnelByUtm[ev.name]!, src);

    const day = utcDay(ev.createdAt);
    const dayBucket = dailyMap.get(day);
    if (dayBucket && ev.name === "guest_signup_completed") {
      dayBucket.guestSignups += 1;
    }
    if (dayBucket && ev.name === "host_signup_completed") {
      dayBucket.hostSignups += 1;
    }

    if (ev.name === "booking_completed") {
      const value = typeof ev.value === "number" ? ev.value : 0;
      bookingRevenue += value;
      const row = bookingsByUtm[src] || { count: 0, revenue: 0 };
      row.count += 1;
      row.revenue += value;
      bookingsByUtm[src] = row;
    }
    if (ev.name === "host_signup_completed") {
      bump(hostSignupsByUtm, src);
    }
    if (ev.name === "guest_signup_completed") {
      bump(guestSignupsByUtm, src);
    }
  }

  const listingViews = funnelCounts.listing_view || 0;
  const bookingStarted = funnelCounts.booking_started || 0;
  const bookingCompleted = funnelCounts.booking_completed || 0;
  const hostSignupStarted = funnelCounts.host_signup_started || 0;
  const hostSignupCompleted = funnelCounts.host_signup_completed || 0;
  const guestSignupStarted = funnelCounts.guest_signup_started || 0;
  const guestSignupCompleted = funnelCounts.guest_signup_completed || 0;

  const topPages = [...pages.entries()]
    .map(([path, v]) => ({
      path,
      views: v.views,
      visitors: v.visitors.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 25);

  const topReferrers = Object.entries(referrers)
    .map(([referrer, views]) => ({ referrer, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 25);

  const topUtmSources = Object.entries(utmViews)
    .map(([source, v]) => ({
      source,
      views: v.views,
      visitors: v.visitors.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 25);

  return {
    from: range.from,
    to: range.to,
    daily: [...dailyMap.entries()].map(([date, v]) => ({
      date,
      visitors: v.visitors.size,
      pageViews: v.pageViews,
      guestSignups: v.guestSignups,
      hostSignups: v.hostSignups,
    })),
    topPages,
    topReferrers,
    topUtmSources,
    funnel: {
      counts: funnelCounts,
      byUtmSource: funnelByUtm,
      conversionRates: {
        listing_view_to_booking_started: rate(bookingStarted, listingViews),
        booking_started_to_booking_completed: rate(
          bookingCompleted,
          bookingStarted,
        ),
        listing_view_to_booking_completed: rate(bookingCompleted, listingViews),
        host_signup_started_to_completed: rate(
          hostSignupCompleted,
          hostSignupStarted,
        ),
        guest_signup_started_to_completed: rate(
          guestSignupCompleted,
          guestSignupStarted,
        ),
      },
    },
    bookings: {
      count: bookingCompleted,
      revenue: Math.round(bookingRevenue * 100) / 100,
      byUtmSource: bookingsByUtm,
    },
    guestSignups: {
      started: guestSignupStarted,
      count: guestSignupCompleted,
      conversionRate: rate(guestSignupCompleted, guestSignupStarted),
      byUtmSource: guestSignupsByUtm,
    },
    hostSignups: {
      started: hostSignupStarted,
      count: hostSignupCompleted,
      conversionRate: rate(hostSignupCompleted, hostSignupStarted),
      byUtmSource: hostSignupsByUtm,
    },
  };
}
