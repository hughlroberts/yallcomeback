import { extractListingFromHtml } from "./extract";
import { parseListingImportUrl } from "./parse-url";
import type { ImportedListingDraft } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Fetch a public Airbnb/VRBO listing page and extract structured fields + photo URLs.
 * Best-effort: OTAs change markup; always review before publish.
 */
export async function fetchListingFromUrl(
  inputUrl: string,
): Promise<ImportedListingDraft> {
  const parsed = parseListingImportUrl(inputUrl);
  if (parsed.source === "unknown") {
    throw new Error(
      "Use an Airbnb or VRBO listing URL (e.g. airbnb.com/rooms/… or vrbo.com/…).",
    );
  }

  let res: Response;
  try {
    res = await fetch(parsed.canonicalUrl, {
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      // Next.js: don't cache OTA pages
      cache: "no-store",
    });
  } catch (e) {
    throw new Error(
      `Network error loading listing: ${e instanceof Error ? e.message : "unknown"}. Try again in a moment.`,
    );
  }

  if (!res.ok) {
    throw new Error(
      `Could not load that listing (HTTP ${res.status}). Check the URL is public, or try again later.`,
    );
  }

  const html = await res.text();
  if (html.length < 2000) {
    throw new Error(
      "The listing page returned too little content (blocked or private). Paste a public share link.",
    );
  }

  const looksBlocked =
    /captcha|access denied|just a moment|cf-browser-verification|challenge-platform|enable javascript to continue/i.test(
      html.slice(0, 12_000),
    );
  if (looksBlocked && !html.includes("listingTitle") && !html.includes("VacationRental")) {
    throw new Error(
      "The listing site blocked automated access from this server. Try again later, or create the listing manually.",
    );
  }

  const draft = extractListingFromHtml({
    html,
    source: parsed.source,
    sourceUrl: parsed.canonicalUrl,
    sourceId: parsed.sourceId,
  });

  if (!draft.title || draft.title === "Imported listing") {
    throw new Error(
      "Could not read listing details from that page. The site may be blocking automated access, or the URL may not be a public room page.",
    );
  }

  return draft;
}
