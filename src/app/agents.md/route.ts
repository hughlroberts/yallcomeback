import { NextRequest, NextResponse } from "next/server";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import { publicOrigin } from "@/lib/agent/origin";
import {
  BRANDED_WEBSITE_USD,
  MARKETPLACE_LISTING_USD,
} from "@/lib/hosting-prices";

export const dynamic = "force-dynamic";

/** Human + agent readable markdown guide. Hosted Yall Come Back only. */
export async function GET(req: NextRequest) {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;
  const origin = publicOrigin(req);
  const md = `# Agent guide — Yall Come Back

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
GET ${origin}/api/v1/search?location=Cedar%20Creek%20Lake&checkIn=2026-08-15&checkOut=2026-08-18&guests=4
\`\`\`

### Flexible dates (“I’m flexible”)

Same semantics as the homepage date picker:

\`\`\`
# Preferred stay ± 3 days
GET ${origin}/api/v1/search?location=Athens%2C%20TX&checkIn=2026-08-15&checkOut=2026-08-18&flexible=true&flexibilityDays=3

# No dates — next free windows
GET ${origin}/api/v1/search?location=Malakoff&flexible=true&guests=4&pets=1&amenities=lake_view
\`\`\`

### Listing detail

\`\`\`
GET ${origin}/api/v1/listings/{slug}?checkIn=2026-08-15&checkOut=2026-08-18
\`\`\`

Use \`listing.url\` and \`listing.bookUrl\` to send humans into the product.

### Pay-first checkout

\`\`\`
POST ${origin}/api/v1/stays/checkout
{
  "slug": "listing-slug",
  "checkIn": "2026-08-15",
  "checkOut": "2026-08-18",
  "guests": 4,
  "guestName": "Guest Name",
  "guestEmail": "guest@example.com",
  "acceptTerms": true
}
\`\`\`

Returns \`checkoutUrl\`. Calendar is written only after the card is paid. Do not send \`paid: true\`. Sessions expire in 30 minutes.

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
