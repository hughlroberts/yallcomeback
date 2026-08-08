import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/agent/origin";

export const dynamic = "force-dynamic";

/**
 * Machine-readable agent instructions (llms.txt convention).
 * https://llmstxt.org/
 */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const body = `# Yall Come Back

> Book direct vacation rentals — host-owned stays, optional marketplace discovery. Texas lakeside focus (Cedar Creek Lake, Athens, Malakoff, and more).

This site is agent-friendly. Prefer the JSON API below over scraping HTML.

## Primary agent endpoints

- OpenAPI 3.1: ${origin}/api/v1/openapi.json
- Search: ${origin}/api/v1/search
- Listing detail: ${origin}/api/v1/listings/{slug}
- Human marketplace: ${origin}/marketplace
- Human docs page: ${origin}/agents.md

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

Returns description, amenities, house rules, photos, host contact, nextWindows, and a quote when dates are given.

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
- For hosts: ${origin}/for-hosts
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
