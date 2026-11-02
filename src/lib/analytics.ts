import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import {
  ANALYTICS_EVENT_NAMES,
  UTM_COOKIE,
  VISITOR_COOKIE,
  type AnalyticsEventName,
  type SignupStartedName,
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
import {
  INTERNAL_COOKIE,
  hasInternalCookieValue,
  isExcludedEmail,
  isInternalAccount,
  isStaffRole,
} from "@/lib/analytics-internal";

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

/**
 * True when the person making this request is internal: the ycb_internal
 * cookie, or a signed-in staff (ADMIN / HOST), excluded-email, or
 * isInternal user. `staffRole: false` skips the role rule (signup completion,
 * where the session may already show the new HOST role).
 */
export async function actorIsInternal(
  opts: { staffRole?: boolean } = {},
): Promise<boolean> {
  try {
    const jar = await cookies();
    if (hasInternalCookieValue(jar.get(INTERNAL_COOKIE)?.value)) return true;
  } catch {
    /* no request scope (e.g. background job) */
  }

  let user: { id?: string; role?: string; email?: string | null } | undefined;
  try {
    const { auth } = await import("@/lib/auth");
    user = (await auth())?.user ?? undefined;
  } catch {
    return false;
  }
  if (!user?.id) return false;
  if (opts.staffRole !== false && isStaffRole(user.role)) return true;
  if (isExcludedEmail(user.email)) return true;
  return userIdIsInternal(user.id);
}

/** isInternal flag or ANALYTICS_EXCLUDE_EMAILS for one account. */
export async function userIdIsInternal(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, isInternal: true },
  });
  return row ? isInternalAccount(row) : false;
}

/** Booking made by an internal account (flag, excluded email, or platform admin). */
export async function bookingIsInternal(
  bookingId: string | null | undefined,
): Promise<boolean> {
  if (!bookingId) return false;
  const row = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      guestEmail: true,
      user: { select: { email: true, isInternal: true, role: true } },
    },
  });
  if (!row) return false;
  if (isExcludedEmail(row.guestEmail)) return true;
  if (!row.user) return false;
  return row.user.role === "ADMIN" || isInternalAccount(row.user);
}

/** Events a visitor causes in their own browser (actor rules apply). */
const ACTOR_EVENTS = new Set<AnalyticsEventName>([
  "listing_view",
  "booking_started",
  "host_signup_started",
  "guest_signup_started",
  "host_signup_completed",
  "guest_signup_completed",
]);

const SIGNUP_COMPLETED = new Set<AnalyticsEventName>([
  "host_signup_completed",
  "guest_signup_completed",
]);

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
  if (await actorIsInternal()) return { ok: true, skipped: "internal" };

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
  /** New account id on *_signup_completed (stored so stats can drop internal accounts). */
  userId?: string | null;
}): Promise<void> {
  const isSignup = SIGNUP_COMPLETED.has(input.name);
  // Host actions and webhooks also record booking_* events: only the
  // visitor-side events use the actor (cookie / session) rules.
  if (ACTOR_EVENTS.has(input.name)) {
    if (await actorIsInternal({ staffRole: !isSignup })) return;
  }
  if (isSignup && (await userIdIsInternal(input.userId))) return;
  if (input.name.startsWith("booking_") && (await bookingIsInternal(input.bookingId))) {
    return;
  }

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
      userId: isSignup ? (input.userId ?? null) : null,
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

export async function recordSignupStartedOnce(
  name: SignupStartedName,
  path: string,
): Promise<void> {
  const attr = await readAttribution();
  if (!attr.visitorId) return;
  const existing = await prisma.analyticsEvent.findFirst({
    where: { name, visitorId: attr.visitorId },
    select: { id: true },
  });
  if (existing) return;
  await recordAnalyticsEvent({ name, path });
}

export { ANALYTICS_EVENT_NAMES };
