import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import {
  ANALYTICS_EVENT_NAMES,
  UTM_COOKIE,
  VISITOR_COOKIE,
  type AnalyticsEventName,
  type UtmAttribution,
  deviceTypeFromUserAgent,
  encodeUtmCookie,
  isBotUserAgent,
  isValidVisitorId,
  parseUtmCookie,
  parseUtmFromSearch,
  sanitizePath,
  sanitizeReferrer,
  shouldSkipAnalyticsPath,
  utmCookieOptions,
  visitorCookieOptions,
} from "@/lib/analytics-visitor";

export type Attribution = {
  visitorId: string | null;
  utm: UtmAttribution | null;
};

export async function readAttribution(): Promise<Attribution> {
  const jar = await cookies();
  const visitorId = jar.get(VISITOR_COOKIE)?.value;
  return {
    visitorId: isValidVisitorId(visitorId) ? visitorId! : null,
    utm: parseUtmCookie(jar.get(UTM_COOKIE)?.value),
  };
}

/** First-touch UTM + visitor id. Sets cookies if middleware has not yet. */
async function ensureAttribution(search?: string | null): Promise<Attribution> {
  const jar = await cookies();
  let visitorId = jar.get(VISITOR_COOKIE)?.value;
  if (!isValidVisitorId(visitorId)) {
    visitorId = crypto.randomUUID();
    try {
      jar.set(VISITOR_COOKIE, visitorId, visitorCookieOptions());
    } catch {
      /* cookies() is read-only in some server contexts */
    }
  }

  let utm = parseUtmCookie(jar.get(UTM_COOKIE)?.value);
  if (!utm && search) {
    utm = parseUtmFromSearch(new URLSearchParams(search.replace(/^\?/, "")));
    if (utm) {
      try {
        jar.set(UTM_COOKIE, encodeUtmCookie(utm), utmCookieOptions());
      } catch {
        /* cookies() is read-only in some server contexts */
      }
    }
  }
  return {
    visitorId: isValidVisitorId(visitorId) ? visitorId! : null,
    utm,
  };
}

async function attributionForEvent(bookingId?: string | null): Promise<Attribution> {
  const fromCookies = await readAttribution();
  if (fromCookies.visitorId || fromCookies.utm) return fromCookies;
  if (!bookingId) return fromCookies;
  const prior = await prisma.analyticsEvent.findFirst({
    where: {
      bookingId,
      name: { in: ["booking_started", "booking_completed"] },
      OR: [{ visitorId: { not: null } }, { utmSource: { not: null } }],
    },
    orderBy: { createdAt: "asc" },
    select: {
      visitorId: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
    },
  });
  if (!prior) return fromCookies;
  return {
    visitorId: prior.visitorId,
    utm: prior.utmSource
      ? {
          source: prior.utmSource,
          medium: prior.utmMedium,
          campaign: prior.utmCampaign,
        }
      : null,
  };
}

export async function recordPageView(input: {
  path: string;
  referrer?: string | null;
  userAgent?: string | null;
  search?: string | null;
}): Promise<{ ok: true; skipped?: string } | { ok: false; error: string }> {
  const ua = input.userAgent ?? (await headers()).get("user-agent");
  if (isBotUserAgent(ua)) return { ok: true, skipped: "bot" };

  const path = sanitizePath(input.path);
  if (!path) return { ok: false, error: "bad_path" };
  if (shouldSkipAnalyticsPath(path)) return { ok: true, skipped: "path" };

  const attr = await ensureAttribution(input.search);
  const visitorId = attr.visitorId;
  if (!visitorId) return { ok: true, skipped: "no_visitor" };

  const utm = attr.utm;

  await prisma.pageView.create({
    data: {
      path,
      referrer: sanitizeReferrer(input.referrer),
      utmSource: utm?.source ?? null,
      utmMedium: utm?.medium ?? null,
      utmCampaign: utm?.campaign ?? null,
      visitorId,
      deviceType: deviceTypeFromUserAgent(ua),
    },
  });
  return { ok: true };
}

export async function recordAnalyticsEvent(input: {
  name: AnalyticsEventName;
  listingId?: string | null;
  bookingId?: string | null;
  value?: number | null;
  path?: string | null;
}): Promise<void> {
  if (input.bookingId) {
    const exists = await prisma.analyticsEvent.findFirst({
      where: { name: input.name, bookingId: input.bookingId },
      select: { id: true },
    });
    if (exists) return;
  }

  const attr = await attributionForEvent(input.bookingId);
  await prisma.analyticsEvent.create({
    data: {
      name: input.name,
      visitorId: attr.visitorId,
      listingId: input.listingId ?? null,
      bookingId: input.bookingId ?? null,
      value:
        typeof input.value === "number" && Number.isFinite(input.value)
          ? input.value
          : null,
      utmSource: attr.utm?.source ?? null,
      utmMedium: attr.utm?.medium ?? null,
      utmCampaign: attr.utm?.campaign ?? null,
      path: sanitizePath(input.path),
    },
  });
}

/** Never fail a booking or signup because analytics write failed. */
export function trackAnalyticsEvent(
  input: Parameters<typeof recordAnalyticsEvent>[0],
): void {
  void recordAnalyticsEvent(input).catch((err) => {
    console.error("[analytics]", input.name, err);
  });
}

export async function recordHostSignupStartedOnce(path: string): Promise<void> {
  const attr = await readAttribution();
  if (!attr.visitorId) return;
  const existing = await prisma.analyticsEvent.findFirst({
    where: { name: "host_signup_started", visitorId: attr.visitorId },
    select: { id: true },
  });
  if (existing) return;
  await recordAnalyticsEvent({
    name: "host_signup_started",
    path,
  });
}

export { ANALYTICS_EVENT_NAMES };
