import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/agent/origin";

export const dynamic = "force-dynamic";

/** Human + agent readable markdown guide. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const md = `# Agent guide — Yall Come Back

Yall Come Back is a book-direct vacation rental platform. Guests can search the optional marketplace or book on a host's own site.

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

## Rate limits / etiquette

- Public read API — no API key for v1 search/detail
- Prefer 60s client cache; avoid hammering calendars
- Do not scrape HTML when JSON exists

## Humans

- Marketplace: ${origin}/marketplace
- For hosts: ${origin}/for-hosts
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
