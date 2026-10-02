/**
 * Two-way iCal setup helpers (pure). ICS feed URLs live in Airbnb/VRBO host
 * settings — they are not on public listing pages, so an agent cannot log in
 * and fetch them. We extract a feed from a pasted URL or messy text, then
 * the host still pastes the Yall Come Back export URL the other way.
 */

export type IcalSiteId = "airbnb" | "vrbo" | "other";

export type IcalSiteGuide = {
  id: IcalSiteId;
  label: string;
  /** Copy their .ics so Yall Come Back can pull busy nights. */
  exportSteps: string[];
  /** Paste the Yall Come Back URL so they block nights booked here. */
  importSteps: string[];
};

export const ICAL_SITES: IcalSiteGuide[] = [
  {
    id: "airbnb",
    label: "Airbnb",
    exportSteps: [
      "On a computer, open Airbnb → Calendar and pick this listing.",
      "Open Availability → Connect calendars (wording may be Sync calendars).",
      "Export calendar and copy the iCal link. It looks like airbnb.com/calendar/ical/….ics?s=…",
    ],
    importSteps: [
      "Same Availability → Connect calendars → connect / import a calendar.",
      "Paste the Yall Come Back URL. Name it Yall Come Back.",
    ],
  },
  {
    id: "vrbo",
    label: "VRBO",
    exportSteps: [
      "Open VRBO or Expedia Partner Central → Calendar for this listing.",
      "Import and export calendars (or Availability tools) → Export / iCal link.",
      "Copy the iCal URL. It often looks like vrbo.com/icalendar/…",
    ],
    importSteps: [
      "Same calendar tools → Import calendar.",
      "Paste the Yall Come Back URL. Name it Yall Come Back.",
    ],
  },
  {
    id: "other",
    label: "Other calendar",
    exportSteps: [
      "In that site’s host calendar, find Export calendar or an iCal / .ics link.",
      "Copy the feed URL (not the public listing page).",
    ],
    importSteps: [
      "Find Import calendar / subscribe from URL.",
      "Paste the Yall Come Back URL and save.",
    ],
  },
];

const HTTP_URL_RE = /https?:\/\/[^\s<>"'`)\]}]+/gi;

function stripTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:]+$/g, "");
}

export function looksLikeIcalFeedUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes(".ics") ||
    u.includes("/ical") ||
    u.includes("icalendar") ||
    u.includes("calendar/ical") ||
    /[?&](?:ical|ics)=/.test(u)
  );
}

/** Public listing pages are not calendar feeds. */
export function looksLikeOtaListingPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsed.pathname;
    if (host.includes("airbnb.") && /\/rooms(?:\/plus)?\/\d+/i.test(path)) {
      return !looksLikeIcalFeedUrl(url);
    }
    if (
      (host.includes("vrbo.") ||
        host.includes("homeaway.") ||
        host.includes("abritel.")) &&
      /\/p\d+/i.test(path)
    ) {
      return !looksLikeIcalFeedUrl(url);
    }
    return false;
  } catch {
    return false;
  }
}

export function guessIcalSourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("airbnb")) return "Airbnb";
    if (
      host.includes("vrbo") ||
      host.includes("homeaway") ||
      host.includes("abritel")
    ) {
      return "VRBO";
    }
    if (host.includes("booking.com")) return "Booking.com";
    if (host.includes("expedia")) return "Expedia";
    if (host.includes("google")) return "Google Calendar";
    if (host.includes("yallcomeback")) return "Yall Come Back";
    const first = host.split(".")[0];
    if (!first) return "Other calendar";
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch {
    return "Other calendar";
  }
}

export function isOwnYcbExportUrl(url: string, propertyId: string): boolean {
  return url.includes(`/api/ical/${propertyId}/`);
}

function tryParseHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProto);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Pull ICS feed URLs from a host paste (clean URL or a blob of page text).
 * Listing pages are ignored. A single pasted URL is accepted even if the
 * path does not look like iCal — probe will reject it if it is not a feed.
 */
export function extractIcalUrlsFromText(paste: string): string[] {
  const found: string[] = [];
  const add = (url: string) => {
    if (!found.includes(url)) found.push(url);
  };
  const text = paste.trim();
  if (!text) return found;

  const whole = tryParseHttpUrl(text);
  if (
    whole &&
    !looksLikeOtaListingPage(whole) &&
    !/[\s]/.test(text)
  ) {
    add(whole);
  }

  for (const match of text.matchAll(HTTP_URL_RE)) {
    const raw = stripTrailingPunctuation(match[0] || "");
    const url = tryParseHttpUrl(raw);
    if (!url) continue;
    if (looksLikeOtaListingPage(url)) continue;
    if (looksLikeIcalFeedUrl(url)) add(url);
  }

  return found.filter((url) => !looksLikeOtaListingPage(url));
}

export function parseLlmUrlJson(text: string): string[] {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[0]) as { urls?: unknown };
    if (!Array.isArray(parsed.urls)) return [];
    return parsed.urls.filter(
      (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u.trim()),
    );
  } catch {
    return [];
  }
}
