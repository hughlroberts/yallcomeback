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

- **Marketplace** on this site: **${marketplacePriceWithCardLabel()}** (card checkout), one line per published listing. Not a cut of the stay.
- **Branded website**: **${brandedPriceLabel()}** (card checkout) for unlimited listings. Marketplace listing of those stays is included (not a second fee).
- **Optional full setup** (we set up listings, brand and website): **${setupServicePriceLabel()}** (card checkout), on any plan.
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

Exact dates but few results? \`flexibleDates\` (null otherwise) suggests up to 4 nearby windows with more stays — check-in ±1–3 days, or a longer stay that meets a minimum (1 night → 2). Each has \`checkIn\`, \`checkOut\`, \`nights\`, \`count\`, \`label\` (“Nov 6–8 · 5 stays”) and \`searchUrl\` — count and label never depend on \`limit\`/\`take\`; “+” (“200+ stays”) only at the 200-stay pool cap; \`flexibleDates.minStay.message\` says e.g. “Some places need a 2-night minimum”. Also on \`GET /api/marketplace/stays\`, which takes the same \`limit\`/\`take\` (default 20, max 50) and returns the same \`count\`, \`returned\` and \`currentCount\`.

\`limit\` (alias \`take\`) defaults to 20, max 50 (larger values are clamped; 0, negative or non-numeric values get 20). \`count\` is every matching stay (not cut to \`limit\`; \`returned\` is how many came back; \`currentCount\` equals \`count\`) and equals \`flexibleDates.currentCount\` for exact dates — both counted over at most 200 candidate stays. \`humanSearchUrl\` and every \`searchUrl\` keep all active filters, amenities included. Past dates or a check-out on/before check-in get HTTP 400 \`{ok:false, code, error}\` (\`past_dates\`, \`checkout_not_after_checkin\`, \`invalid_date\`).

### Listing detail

\`\`\`
GET ${origin}/api/v1/listings/{slug}?checkIn=${checkIn}&checkOut=${checkOut}&guests=4&pets=1
\`\`\`

Each result uses the **property** slug in \`slug\`, \`url\`, \`bookUrl\`, and \`apiUrl\`. The host brand slug is \`hostSlug\` (also under \`host.slug\`).

Use \`listing.url\` and \`listing.bookUrl\` to send humans into the product. \`bookUrl\` (listing and search) keeps the dates, \`guests\` and \`pets\` you sent (pets only when the listing takes that many; pets must be 0–10, else 400 \`invalid_pets\`).

Extra guests: listing and search results have \`extraGuestFee\` (per night for each guest beyond \`extraGuestsIncluded\`; 0 = none) and \`extraGuestsIncluded\`. Search \`priceEstimate.extraGuestFee\` and listing \`availability.quote.extraGuestFee\` are that charge for the whole stay, already in the total. The quote also has \`availability.quote.guests\` (guests it is priced for, capped at \`maxGuests\`) and \`availability.quote.extraGuests\` (guests beyond \`extraGuestsIncluded\`, even when the fee is 0); search \`priceEstimate.extraGuests\` is the same at the searched guest count.

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

Public: no token or API key, rate limited per IP (10 per 15 minutes, 40 per day) and per guest email (5 per hour); a 429 has a \`Retry-After\` header and names the limit in the body. Returns \`checkoutUrl\`. Dates are not held; the calendar is written only after the card is paid. If another guest pays for overlapping nights first, this payment is refunded in full automatically and the booking is cancelled. A 409 means the dates are taken or the host is not ready to take a card deposit yet. Do not send \`paid: true\`. Sessions expire in 30 minutes.

### Ask the host a question (before booking)

\`\`\`
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
\`\`\`

AI agents are welcome; send only for a real person who wants the answer. The host replies by email to \`guestEmail\` and sees the question in their inbox. Returns 201 \`{ok, inquiryId, duplicate, hostNotification, guestConfirmation}\` (\`guestConfirmation\` is the receipt email to \`guestEmail\`: sent, capped at 1 per hour and 3 per day per address, opted_out, not_sent or skipped); the same question again from the same email within 24 hours returns 200 with \`duplicate: true\` and is not re-sent. Limits (HTTP 429): per IP 5 per 10 minutes and 20 per day, per guest email 3 per hour and 10 per day, per listing 20 per hour, per host 60 per hour and 300 per day. A duplicate (200, \`duplicate: true\`) does not count toward the per-IP limits. A 429 body names the limit (\`limit.name\`, \`limit.max\`, \`limit.windowSeconds\`) and gives \`retryAfterSeconds\`; the \`Retry-After\` header has the same value. HTTP 422 for more than one link, links in the name or subject, HTML, link shorteners, or spam wording. \`message\` is 5 to 2000 characters. Hosts and co-hosts get an email for every question right away. Only during a flood (more than 10 emails to one host in 10 minutes) are later messages grouped into one email when that 10-minute window ends.

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
