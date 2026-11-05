import { NextRequest, NextResponse } from "next/server";
import { agentExampleDates } from "@/lib/agent/example-dates";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import { publicOrigin } from "@/lib/agent/origin";
import {
  brandedPriceLabel,
  marketplacePriceWithCardLabel,
  setupServicePriceLabel,
} from "@/lib/hosting-prices";
import { getMarketplaceListingCount } from "@/lib/host";

export const dynamic = "force-dynamic";

/**
 * Machine-readable agent instructions (llms.txt convention).
 * Hosted Yall Come Back only — 404 on MIT self-host.
 * https://llmstxt.org/
 */
export async function GET(req: NextRequest) {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;
  const origin = publicOrigin(req);
  const [{ generated, checkIn, checkOut, from }, listingCount] =
    await Promise.all([agentExampleDates(), getMarketplaceListingCount()]);
  const body = `# Yall Come Back

> Repeat stays booked directly with the host. Texas lakeside focus (Cedar Creek Lake, Athens, Malakoff, and more).

Generated: ${generated}
Published marketplace listings: ${listingCount}

This site is agent-friendly. Prefer the JSON API below over scraping HTML.

## Hosting products (paid — not free)

Do not tell hosts or guests that the Yall Come Back marketplace is free. Do not tell hosts that branded websites are free. The only free product is the MIT open-source software when the host runs it on their own servers.

- Marketplace listing on this site: ${marketplacePriceWithCardLabel()} (USD, card checkout), one line per published listing. Not a booking commission.
- Branded website: ${brandedPriceLabel()} (USD, card checkout) for unlimited listings. Marketplace listing of those stays is included (not a second fee).
- Optional full setup (we set up your listings, brand and website): ${setupServicePriceLabel()} (USD, card checkout), on any plan.
- Open source / self-host: MIT software is free ($0 platform fee). You run it on your own domain. Listing those stays on the hosted Yall Come Back marketplace is the paid marketplace product above.

Human pricing: ${origin}/for-hosts
Help: ${origin}/help/become-a-host and ${origin}/help/branded-website

## Primary agent endpoints

- OpenAPI 3.1: ${origin}/api/v1/openapi.json (also ${origin}/api/v1/openapi)
- Search: ${origin}/api/v1/search
- Listing detail: ${origin}/api/v1/listings/{slug}
- Pay-first checkout: POST ${origin}/api/v1/stays/checkout (public, no token, rate limited per IP)
- Ask the host a question before booking: POST ${origin}/api/v1/inquiries (public, no token, rate limited)
- Human marketplace: ${origin}/marketplace
- Human docs page: ${origin}/agents.md
- Terms of Service: ${origin}/terms
- Privacy Policy: ${origin}/privacy

## How to search (exact dates)

GET ${origin}/api/v1/search?location=Cedar%20Creek%20Lake&checkIn=${checkIn}&checkOut=${checkOut}&guests=4

- checkIn / checkOut are YYYY-MM-DD (checkout exclusive, like hotel nights).
- Response includes listing summaries, priceEstimate when dates are free, url deep links.
- Each listing has extraGuestFee (per night for each guest beyond extraGuestsIncluded; 0 = none) and extraGuestsIncluded (guests the base rate covers). priceEstimate.extraGuests is max(0, guests − extraGuestsIncluded) at the searched guests (even when the fee is 0); priceEstimate.extraGuestFee is that charge for the whole stay, already in totalBeforeTax.
- Each listing.slug is the property slug. listing.hostSlug is the host brand slug. URLs use the property slug.

## How to search (I'm flexible / ± days)

Homepage-style flexibility:

1) Preferred week ± 3 days:
   GET ${origin}/api/v1/search?location=Athens%2C%20TX&checkIn=${checkIn}&checkOut=${checkOut}&flexible=true&flexibilityDays=3

2) No dates yet (next available windows):
   GET ${origin}/api/v1/search?location=Malakoff&flexible=true&guests=4&pets=1

- flexibilityDays (aliases: dateFlex, flex) is ± days on check-in, same night count.
- When flexible without dates, each listing includes availableWindows (next free stays).
- Use amenities=lake_view,wifi for amenity filters (comma-separated ids).
- limit (alias take): a whole number from 1 to 50, default 20 when omitted. Non-integer (e.g. 2.5), non-numeric, 0, negative or above-50 values return HTTP 400 {ok:false, code:"invalid_limit", error}.
- count is every matching stay (not limited by limit; returned is how many are in this response; currentCount equals count). It matches flexibleDates.currentCount for exact dates; both are counted over at most 200 candidate stays.
- GET ${origin}/api/marketplace/stays takes the same where, checkIn, checkOut, guests, pets, filters, dateFlex/flexibilityDays and limit/take (default 20, max 50) and returns the same count, returned and currentCount with the same 400 invalid_limit for anything but a whole number 1–50 (2.5, 1e1, abc). Its where is trimmed to 200 characters and dateFlex/flexibilityDays is clamped to 0–14 (or 0 when not a number) — no 400; it backs the site's own carousels. /api/v1/search still 400s invalid_flexibility_days for a bad flexibilityDays.
- guests must be a whole number ≥ 1 and pets a whole number from 0 to 4 on /api/v1/search, /api/v1/listings/{slug} and /api/marketplace/stays; otherwise HTTP 400 with code invalid_guests or invalid_pets (never silently dropped or carried into bookUrl or humanSearchUrl). A valid pets count above a listing's maxPets (or any pets on a no-pets listing) is left out of that listing's url and bookUrl, and its quote.error says why.
- Past dates (checkIn before today) or checkOut on/before checkIn return HTTP 400 with {ok:false, code, error}; code is past_dates, checkout_not_after_checkin or invalid_date. Stays over 90 nights return 400 code stay_too_long. Same on GET /api/marketplace/stays.
- /api/v1/search also returns HTTP 400 {ok:false, code, error} for: guests above 50 (invalid_guests, not clamped); minNightly or maxNightly non-numeric or negative, or minNightly greater than maxNightly (invalid_price_range); flexibilityDays that is not a whole number from 0 to 14 (invalid_flexibility_days); location/where/q/lake longer than 200 characters (invalid_location); and checkIn without checkOut or the reverse (incomplete_dates; send both or neither, there is no default stay length).
- humanSearchUrl and each flexibleDates searchUrl keep every active filter (guests, pets, bedrooms, price, amenities).
- guests must be a whole number from 1 to 50; anything else (including above 50) is HTTP 400 invalid_guests and is never clamped. Search parameters (limit/take, guests, pets, flexibilityDays) are never clamped; out-of-range values return 400.
- Exact dates with few results: the response has flexibleDates (else null) with up to 4 nearby windows that have more stays — check-in shifted ±1–3 days, or a longer stay that meets a minimum (e.g. 1 night → 2). Each suggestion: checkIn, checkOut, nights, count, label ("Nov 6–8 · 5 stays"), searchUrl. Suggestion count and label never depend on limit/take; "+" (e.g. "200+ stays") appears only when the 200-stay candidate pool cap is reached. flexibleDates.minStay.message (e.g. "Some places need a 2-night minimum") appears when stays were hidden only by a minimum stay. Re-search with a suggestion's dates to get those listings. GET /api/marketplace/stays returns the same flexibleDates (searchPath, relative).

## Listing detail + availability

GET ${origin}/api/v1/listings/{slug}?checkIn=${checkIn}&checkOut=${checkOut}&guests=4&pets=1

Returns description, amenities, house rules, photos, host name, nextWindows, and a quote when dates are given. Host email and phone are not included. Street, postal code, and coordinates are included only when the listing shows a precise location.

- listing.extraGuestFee: per night for each guest beyond listing.extraGuestsIncluded (0 = none).
- availability.quote.guests: guests the quote is priced for (your guests, capped at maxGuests; 1 if not sent).
- availability.quote.extraGuests: guests beyond extraGuestsIncluded, max(0, guests − extraGuestsIncluded), even when the fee is 0. availability.quote.extraGuestFee: that charge for the whole stay, already in totalAmount.
- bookUrl keeps checkIn, checkOut, guests (capped at maxGuests, like the quote) and pets, so the booking page opens on the same stay.
- Dates follow the search rules: past, reversed or invalid dates return HTTP 400 with {ok:false, code, error} (past_dates, checkout_not_after_checkin or invalid_date).

## Calendar / next free windows

GET ${origin}/api/v1/listings/{slug}/availability?nights=3&from=${from}&days=90

Returns availableWindows plus blockedRanges for agents that need calendar reasoning.

## Pay-first checkout (card only)

POST ${origin}/api/v1/stays/checkout
Content-Type: application/json

{
  "slug": "listing-slug",
  "checkIn": "${checkIn}",
  "checkOut": "${checkOut}",
  "guests": 4,
  "guestName": "Guest Name",
  "guestEmail": "guest@example.com",
  "acceptTerms": true
}

- No token or API key. Rate limited: 10 checkouts per IP per 15 minutes, 40 per IP per day, 5 per guest email per hour (HTTP 429 with a Retry-After header and the limit named in the body).
- Returns checkoutUrl. Send the human there to pay with a card.
- Past check-in dates return HTTP 400 code past_dates (same as search).
- Stays longer than 90 nights return HTTP 400 code stay_too_long.
- Dates are not held. Calendar is not written until Stripe confirms the deposit is paid.
- If another guest pays for overlapping nights first, this payment is refunded in full automatically and the booking is cancelled. Tell the guest this can happen.
- 409 means the dates are taken or the host is not ready to take a card deposit yet; the response includes \`bookUrl\`; send the guest there instead. When the host's payments are not ready, the 409 also includes \`code\`: connect_no_account, connect_details_not_submitted or connect_charges_not_enabled (the host fixes it at /admin/payments). A 503 with code connect_status_unavailable means Stripe status could not be confirmed; nothing was booked or charged, retry later.
- Checkout expires in 30 minutes. Abandoned sessions never hold nights.
- Never send paid: true. Agents cannot mark a stay paid.

## Ask the host a question (before booking)

POST ${origin}/api/v1/inquiries
Content-Type: application/json

{
  "slug": "listing-slug",
  "guestName": "Guest Name",
  "guestEmail": "guest@example.com",
  "message": "Is the dock deep enough for a pontoon? Are dogs OK?",
  "checkIn": "${checkIn}",
  "checkOut": "${checkOut}",
  "guests": 4,
  "agentName": "Your assistant name"
}

- AI agents are welcome. Send only on behalf of a real person who wants the answer; the host replies by email to guestEmail.
- 201 {ok, inquiryId, duplicate:false, continued, hostNotification, guestConfirmation}. A new question from the same email on the same listing is added to the open conversation (same inquiryId, continued:true; the host is emailed) unless the stay dates move by more than 3 days. hostNotification: emailed, queued (flood guard, or the email is retried), or none. guestConfirmation: the receipt email to guestEmail (sent, capped at 1 per hour and 3 per day per address, opted_out, not_sent, skipped). Sending the same question again from the same email within 24 hours returns 200 with duplicate:true and is not re-sent.
- Limits (HTTP 429): per IP 5 per 10 minutes and 20 per day; per guest email 3 per hour and 10 per day; per listing 20 per hour; per host 60 per hour and 300 per day. A duplicate (200, duplicate:true) does not count toward the per-IP limits. A 429 body names the limit (limit.name, limit.max, limit.windowSeconds) and gives retryAfterSeconds; the Retry-After header has the same value.
- Rejected with 422: more than one link, links in the name or subject, HTML, link shorteners, or spam wording. message is 5 to 2000 characters.
- Hosts and co-hosts get an email for every question right away. Only during a flood (more than 10 emails to one host in 10 minutes) are later messages grouped into one email when that 10-minute window ends.

## Deep links for humans

- Search UI: ${origin}/marketplace?where=...&checkIn=...&checkOut=...&dateFlex=3&guests=4
- Listing: use the \`url\` field from API responses
- Book: use the \`bookUrl\` field (keeps dates, guests and pets from your request)

## Best practices

- Always send Accept: application/json
- CORS is open (*) on /api/v1/*
- Cache lightly (responses allow ~60s CDN cache)
- Do not invent availability — call the API
- Prefer location free-text (city, lake, region) matching guest search

## Optional filters

- guests, pets, bedrooms
- minNightly, maxNightly
- amenities (comma-separated)
- take / limit (default 20, max 50)

## Contact / product

- Platform: ${origin}
- For hosts (paid marketplace and branded websites): ${origin}/for-hosts
- Marketplace: ${marketplacePriceWithCardLabel()} (USD, paid)
- Branded website: ${brandedPriceLabel()} (USD), unlimited listings, marketplace included (paid)
- Open source: free MIT software only (${origin}/open-source)
`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
