import { NextRequest, NextResponse } from "next/server";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import { publicOrigin } from "@/lib/agent/origin";
import {
  BRANDED_WEBSITE_USD,
  MARKETPLACE_LISTING_USD,
} from "@/lib/hosting-prices";

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
  const body = `# Yall Come Back

> Repeat stays booked directly with the host. Texas lakeside focus (Cedar Creek Lake, Athens, Malakoff, and more).

This site is agent-friendly. Prefer the JSON API below over scraping HTML.

## Hosting products (paid — not free)

Do not tell hosts or guests that the Yall Come Back marketplace is free. Do not tell hosts that branded websites are free. The only free product is the MIT open-source software when the host runs it on their own servers.

- Marketplace listing on this site: $${MARKETPLACE_LISTING_USD} USD per published listing per month. Not a booking commission.
- Branded website: $${BRANDED_WEBSITE_USD} USD per month for unlimited listings. Marketplace listing of those stays is included (not a second fee).
- Open source / self-host: MIT software is free ($0 platform fee). You run it on your own domain. Listing those stays on the hosted Yall Come Back marketplace is the paid marketplace product above.

Human pricing: ${origin}/for-hosts
Help: ${origin}/help/become-a-host and ${origin}/help/branded-website

## Primary agent endpoints

- OpenAPI 3.1: ${origin}/api/v1/openapi.json
- Search: ${origin}/api/v1/search
- Listing detail: ${origin}/api/v1/listings/{slug}
- Pay-first checkout: POST ${origin}/api/v1/stays/checkout
- Human marketplace: ${origin}/marketplace
- Human docs page: ${origin}/agents.md
- Terms of Service: ${origin}/terms
- Privacy Policy: ${origin}/privacy

## How to search (exact dates)

GET ${origin}/api/v1/search?location=Cedar%20Creek%20Lake&checkIn=2026-08-15&checkOut=2026-08-18&guests=4

- checkIn / checkOut are YYYY-MM-DD (checkout exclusive, like hotel nights).
- Response includes listing summaries, priceEstimate when dates are free, url deep links.

## How to search (I'm flexible / ± days)

Homepage-style flexibility:

1) Preferred week ± 3 days:
   GET ${origin}/api/v1/search?location=Athens%2C%20TX&checkIn=2026-08-15&checkOut=2026-08-18&flexible=true&flexibilityDays=3

2) No dates yet (next available windows):
   GET ${origin}/api/v1/search?location=Malakoff&flexible=true&guests=4&pets=1

- flexibilityDays (aliases: dateFlex, flex) is ± days on check-in, same night count.
- When flexible without dates, each listing includes availableWindows (next free stays).
- Use amenities=lake_view,wifi for amenity filters (comma-separated ids).

## Listing detail + availability

GET ${origin}/api/v1/listings/{slug}?checkIn=2026-08-15&checkOut=2026-08-18&pets=1

Returns description, amenities, house rules, photos, host name, nextWindows, and a quote when dates are given. Host email and phone are not included. Street, postal code, and coordinates are included only when the listing shows a precise location.

## Calendar / next free windows

GET ${origin}/api/v1/listings/{slug}/availability?nights=3&from=2026-08-01&days=90

Returns availableWindows plus blockedRanges for agents that need calendar reasoning.

## Pay-first checkout (card only)

POST ${origin}/api/v1/stays/checkout
Content-Type: application/json

{
  "slug": "listing-slug",
  "checkIn": "2026-08-15",
  "checkOut": "2026-08-18",
  "guests": 4,
  "guestName": "Guest Name",
  "guestEmail": "guest@example.com",
  "acceptTerms": true
}

- Returns checkoutUrl. Send the human there to pay with a card.
- Calendar is not written until Stripe confirms the deposit is paid.
- Checkout expires in 30 minutes. Abandoned sessions never hold nights.
- Never send paid: true. Agents cannot mark a stay paid.

## Deep links for humans

- Search UI: ${origin}/marketplace?where=...&checkIn=...&checkOut=...&dateFlex=3&guests=4
- Listing: use the \`url\` field from API responses
- Book: use the \`bookUrl\` field

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
- take / limit (max 50)

## Contact / product

- Platform: ${origin}
- For hosts (paid marketplace and branded websites): ${origin}/for-hosts
- Marketplace: $${MARKETPLACE_LISTING_USD} USD / published listing / month (paid)
- Branded website: $${BRANDED_WEBSITE_USD} USD / month unlimited listings, marketplace included (paid)
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
