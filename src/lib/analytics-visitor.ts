import type { NextRequest, NextResponse } from "next/server";

export const VISITOR_COOKIE = "ycb_vid";
export const UTM_COOKIE = "ycb_utm";

const VID_MAX_AGE = 60 * 60 * 24 * 365;
const UTM_MAX_AGE = 60 * 60 * 24 * 90;
const VID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTM_TOKEN_RE = /^[a-zA-Z0-9._-]{1,64}$/;

export const ANALYTICS_EVENT_NAMES = [
  "listing_view",
  "booking_started",
  "booking_completed",
  "booking_cancelled",
  "host_signup_started",
  "host_signup_completed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type UtmAttribution = {
  source: string;
  medium: string | null;
  campaign: string | null;
};

export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);
}

export function sanitizeUtmToken(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  return UTM_TOKEN_RE.test(v) ? v : null;
}

export function parseUtmFromSearch(
  searchParams: URLSearchParams,
): UtmAttribution | null {
  const source = sanitizeUtmToken(searchParams.get("utm_source"));
  if (!source) return null;
  return {
    source,
    medium: sanitizeUtmToken(searchParams.get("utm_medium")),
    campaign: sanitizeUtmToken(searchParams.get("utm_campaign")),
  };
}

export function parseUtmCookie(raw: string | undefined | null): UtmAttribution | null {
  if (!raw) return null;
  const parts = raw.split("\t");
  const source = sanitizeUtmToken(parts[0]);
  if (!source) return null;
  return {
    source,
    medium: sanitizeUtmToken(parts[1] || null),
    campaign: sanitizeUtmToken(parts[2] || null),
  };
}

export function encodeUtmCookie(utm: UtmAttribution): string {
  return [utm.source, utm.medium ?? "", utm.campaign ?? ""].join("\t");
}

export function isValidVisitorId(raw: string | undefined | null): boolean {
  return Boolean(raw && VID_RE.test(raw));
}

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /bot|crawler|spider|crawling|preview|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|embedly|quora link|pinterest|googlebot|bingbot|yandex|baidu|duckduck|semrush|ahrefs|mj12|dotbot|gptbot|chatgpt|claudebot|anthropic|perplexity|bytespider|amazonbot|applebot|ia_archiver|grokbot|pingdom|uptimerobot|statuscake|headlesschrome|phantomjs|puppeteer|playwright/i.test(
    ua,
  );
}

export function deviceTypeFromUserAgent(ua: string | null | undefined): DeviceType {
  if (!ua) return "unknown";
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) && !/Mobile/.test(ua)) return "tablet";
  if (/iPad/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile/i.test(ua)) {
    return "mobile";
  }
  if (/Android|Tablet/i.test(ua)) return "tablet";
  return "desktop";
}

export function shouldSkipAnalyticsPath(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  if (path.startsWith("/admin")) return true;
  if (path.startsWith("/ops")) return true;
  if (path.startsWith("/api")) return true;
  if (path.startsWith("/_next")) return true;
  return false;
}

export function sanitizePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let path = raw.trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  path = path.split("?")[0] || "/";
  if (path.length > 200) path = path.slice(0, 200);
  return path;
}

/** Keep origin + path, drop query (tokens, emails). */
export function sanitizeReferrer(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const url = new URL(v);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const out = `${url.origin}${url.pathname}`.replace(/\/$/, "") || url.origin;
    return out.slice(0, 200);
  } catch {
    return null;
  }
}

export function visitorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: VID_MAX_AGE,
  };
}

export function utmCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: UTM_MAX_AGE,
  };
}

/** First-touch UTM + anonymous visitor id. Safe in Edge middleware. */
export function applyVisitorCookies(
  req: NextRequest,
  res: NextResponse,
): NextResponse {
  const existingVid = req.cookies.get(VISITOR_COOKIE)?.value;
  if (!isValidVisitorId(existingVid)) {
    res.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), visitorCookieOptions());
  }

  const existingUtm = parseUtmCookie(req.cookies.get(UTM_COOKIE)?.value);
  if (!existingUtm) {
    const fromUrl = parseUtmFromSearch(req.nextUrl.searchParams);
    if (fromUrl) {
      res.cookies.set(UTM_COOKIE, encodeUtmCookie(fromUrl), utmCookieOptions());
    }
  }
  return res;
}
