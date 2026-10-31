import { NextRequest, NextResponse } from "next/server";
import { agentExampleDates } from "@/lib/agent/example-dates";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import { publicOrigin } from "@/lib/agent/origin";
import {
  BRANDED_WEBSITE_USD,
  MARKETPLACE_LISTING_USD,
} from "@/lib/hosting-prices";
import { getMarketplaceListingCount } from "@/lib/host";

export const dynamic = "force-dynamic";

/** Human + agent readable markdown guide. Hosted Yall Come Back only. */
export async function GET(req: NextRequest) {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;
  const origin = publicOrigin(req);
  const [{ generated, checkIn, checkOut }, listingCount] = await Promise.all([
    agentExampleDates(),
    getMarketplaceListingCount(),
  ]);
  const md = `# Agent guide — Yall Come Back

Generated: ${generated}
Published marketplace listings: ${listingCount}

Yall Come Back is for guests coming back to a host they already know. Search the marketplace or book on a host's own site. Bookings are a contract between host and guest; the platform is not a party. See [${origin}/terms](${origin}/terms) and [${origin}/privacy](${origin}/privacy).

## Hosting is paid (do not call the marketplace free)

The hosted marketplace and branded websites are paid products. Open-source software is the only free product.

- **Marketplace** on this site: **$${MARKETPLACE_LISTING_USD} / published listing / month**. Not a cut of the stay.
- **Branded website**: **$${BRANDED_WEBSITE_USD} / month** for unlimited listings. Marketplace listing of those stays is included (not a second fee).
- **Open source / self-host**: MIT software is **$0** platform fee when the host runs it. Listing on the hosted Yall Come Back marketplace is the paid marketplace product.

Do not tell users the marketplace is free. Do not tell users branded websites are free. Pricing for humans: [${origin}/for-hosts](${origin}/for-hosts).

## For AI agents

Start here:

1. Fetch [\`/llms.txt\`](${origin}/llms.txt) for a compact machine brief
2. Fetch [\`/api/v1/openapi.json\`](${origin}/api/v1/openapi.json) for the full contract
3. Call [\`/api/v1/search\`](${origin}/api/v1/search) then [\`/api/v1/listings/{slug}\`](${origin}/api/v1/listings)

### Exact dates

\`\`\`
GET ${origin}/api/v1/search?location=Cedar%20Creek%20Lake&checkIn=${checkIn}&checkOut=${checkOut}&guests=4
\`\`\`

### Flexible dates (“I’m flexible”)

Same semantics as the homepage date picker:

\`\`\`
# Preferred stay ± 3 days
GET ${origin}/api/v1/search?location=Athens%2C%20TX&checkIn=${checkIn}&checkOut=${checkOut}&flexible=true&flexibilityDays=3

# No dates — next free windows
GET ${origin}/api/v1/search?location=Malakoff&flexible=true&guests=4&pets=1&amenities=lake_view
\`\`\`

Exact dates but few results? \`flexibleDates\` (null otherwise) suggests up to 4 nearby windows with more stays — check-in ±1–3 days, or a longer stay that meets a minimum (1 night → 2). Each has \`checkIn\`, \`checkOut\`, \`nights\`, \`count\`, \`label\` (“Nov 6–8 · 5 stays”) and \`searchUrl\`; \`flexibleDates.minStay.message\` says e.g. “Some places need a 2-night minimum”. Also on \`GET /api/marketplace/stays\`.

### Listing detail

\`\`\`
GET ${origin}/api/v1/listings/{slug}?checkIn=${checkIn}&checkOut=${checkOut}
\`\`\`

Each result uses the **property** slug in \`slug\`, \`url\`, \`bookUrl\`, and \`apiUrl\`. The host brand slug is \`hostSlug\` (also under \`host.slug\`).

Use \`listing.url\` and \`listing.bookUrl\` to send humans into the product.

### Pay-first checkout

\`\`\`
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
\`\`\`

Public: no token or API key, rate limited per IP (10 per 15 minutes, 40 per day) and per guest email (5 per hour). Returns \`checkoutUrl\`. Dates are not held; the calendar is written only after the card is paid. If another guest pays for overlapping nights first, this payment is refunded in full automatically and the booking is cancelled. A 409 means the dates are taken or the host is not ready to take a card deposit yet. Do not send \`paid: true\`. Sessions expire in 30 minutes.

## Rate limits / etiquette

- Public read API — no API key for v1 search/detail
- Prefer 60s client cache; avoid hammering calendars
- Do not scrape HTML when JSON exists

## Humans

- Marketplace: ${origin}/marketplace
- For hosts (paid products): ${origin}/for-hosts
- Open source (the only free product): ${origin}/open-source
`;

  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
