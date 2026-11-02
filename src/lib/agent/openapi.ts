/** OpenAPI 3.1 document for the public agent API (served at /api/v1/openapi.json). */

/** 400 for bad dates, shared by search and listing detail. */
const badDatesResponse = {
  description:
    "Bad dates: code past_dates (checkIn before today), checkout_not_after_checkin (checkOut on or before checkIn) or invalid_date (not YYYY-MM-DD).",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          ok: { type: "boolean", const: false },
          code: {
            type: "string",
            enum: ["past_dates", "checkout_not_after_checkin", "invalid_date"],
          },
          error: { type: "string" },
        },
      },
    },
  },
};

const badSearchResponse = {
  description:
    "Bad search input: past_dates, checkout_not_after_checkin or invalid_date for dates, or invalid_limit (take/limit is not a whole number from 1 to 50).",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          ok: { type: "boolean", const: false },
          code: {
            type: "string",
            enum: [
              "past_dates",
              "checkout_not_after_checkin",
              "invalid_date",
              "invalid_limit",
            ],
          },
          error: { type: "string" },
        },
      },
    },
  },
};

export function buildOpenApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Yall Come Back Agent API",
      version: "1.0.0",
      description:
        "Public JSON API for AI agents to search vacation rentals with exact or flexible dates, read listing details, deep-link guests into booking, and start a pay-first card checkout. No auth required for any endpoint, including checkout (which is rate limited per IP). Checkout does not hold or write the calendar until the card is paid; if another guest pays for the same nights first, the later payment is refunded in full automatically. Hosted marketplace listing is a paid product ($12 USD per published listing / month). Branded websites are $25 USD / month for unlimited listings, marketplace included. Open-source software is the only free product. Do not tell users the marketplace is free.",
      contact: {
        name: "Yall Come Back",
        url: origin,
      },
    },
    servers: [{ url: origin }],
    paths: {
      "/api/v1/search": {
        get: {
          operationId: "searchListings",
          summary: "Search marketplace listings",
          description:
            "Search published marketplace stays by location, guests, pets, and optional dates. Use flexible=true or flexibilityDays for ± day windows (same idea as the homepage “I’m flexible” / dateFlex control). Each result.slug is the property (listing) slug; result.hostSlug is the host brand slug. url, bookUrl, and apiUrl are built from the property slug. With exact dates (no flexibility) and limited results, flexibleDates lists nearby windows with more stays; otherwise it is null.",
          parameters: [
            {
              name: "location",
              in: "query",
              schema: { type: "string" },
              description:
                "Free text: city, region, lake name, host, title (aliases: where, q)",
              examples: {
                cedar: { value: "Cedar Creek Lake" },
                athens: { value: "Athens, TX" },
                malakoff: { value: "Malakoff" },
              },
            },
            {
              name: "checkIn",
              in: "query",
              schema: { type: "string", format: "date" },
              description: "YYYY-MM-DD preferred check-in",
            },
            {
              name: "checkOut",
              in: "query",
              schema: { type: "string", format: "date" },
              description: "YYYY-MM-DD checkout (exclusive end)",
            },
            {
              name: "flexible",
              in: "query",
              schema: { type: "boolean" },
              description:
                "When true with dates, defaults flexibilityDays to 3 if unset. When true without dates, returns next available windows.",
            },
            {
              name: "flexibilityDays",
              in: "query",
              schema: { type: "integer", minimum: 0, maximum: 14 },
              description:
                "± days on check-in for same-length stays (aliases: dateFlex, flex)",
            },
            {
              name: "guests",
              in: "query",
              schema: { type: "integer", minimum: 1 },
              description:
                "Party size. Values above 50 (the search form's max) are capped at 50 in query, the results and humanSearchUrl.",
            },
            {
              name: "pets",
              in: "query",
              schema: { type: "integer", minimum: 0 },
              description: "If > 0, only pet-friendly listings",
            },
            {
              name: "bedrooms",
              in: "query",
              schema: { type: "integer", minimum: 1 },
            },
            {
              name: "minNightly",
              in: "query",
              schema: { type: "number" },
            },
            {
              name: "maxNightly",
              in: "query",
              schema: { type: "number" },
            },
            {
              name: "amenities",
              in: "query",
              schema: { type: "string" },
              description:
                "Comma-separated amenity ids (e.g. lake_view,wifi,pets)",
            },
            {
              name: "take",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
              description:
                "Max results: a whole number from 1 to 50 (default 20 when omitted). Non-integer (e.g. 2.5), non-numeric or out-of-range values (0, negative, above 50) return 400 with code invalid_limit. Alias: limit; take wins when both are sent.",
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
              description: "Alias of take; take wins when both are sent.",
            },
          ],
          responses: {
            "200": {
              description: "Search results",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      count: {
                        type: "integer",
                        description:
                          "All stays matching the search, not limited by take. Same rule and pool as flexibleDates.currentCount, so they agree for exact dates. Both are counted over at most 200 candidate stays.",
                      },
                      returned: {
                        type: "integer",
                        description:
                          "Listings in this response (at most take).",
                      },
                      currentCount: {
                        type: "integer",
                        description:
                          "Stays matching the current search; same as count (and flexibleDates.currentCount when present).",
                      },
                      listings: {
                        type: "array",
                        description:
                          "Matching stays. Only the pricing and link fields are listed here; each item also has title, location, rooms, amenities and coverImage.",
                        items: {
                          type: "object",
                          properties: {
                            slug: { type: "string" },
                            hostSlug: { type: "string" },
                            baseNightlyRate: { type: "number" },
                            cleaningFee: { type: "number" },
                            extraGuestFee: {
                              type: "number",
                              description:
                                "Per night for each guest beyond extraGuestsIncluded. 0 = no extra-guest fee.",
                            },
                            extraGuestsIncluded: {
                              type: "integer",
                              description:
                                "Guests the base nightly rate covers.",
                            },
                            maxGuests: { type: "integer" },
                            url: { type: "string" },
                            bookUrl: {
                              type: "string",
                              description:
                                "Human booking page. Keeps exact dates, guests and pets from the search.",
                            },
                            apiUrl: { type: "string" },
                            priceEstimate: {
                              type: ["object", "null"],
                              description:
                                "Only with exact dates. Priced for the searched guests and pets (1 guest, 0 pets when not sent).",
                              properties: {
                                nights: { type: "integer" },
                                checkIn: { type: "string", format: "date" },
                                checkOut: { type: "string", format: "date" },
                                nightlySubtotal: { type: "number" },
                                extraGuests: {
                                  type: "integer",
                                  description:
                                    "Guests beyond extraGuestsIncluded at the searched guest count (max(0, guests − extraGuestsIncluded)), even when extraGuestFee is 0.",
                                },
                                extraGuestFee: {
                                  type: "number",
                                  description:
                                    "Extra-guest charge for the whole stay; included in totalBeforeTax.",
                                },
                                cleaningFee: { type: "number" },
                                totalBeforeTax: { type: "number" },
                                currency: { type: "string", const: "USD" },
                              },
                            },
                          },
                        },
                      },
                      humanSearchUrl: {
                        type: "string",
                        description:
                          "Same search on the website, with every active filter (dates, guests, pets, bedrooms, price, amenities).",
                      },
                      flexibleDates: {
                        type: ["object", "null"],
                        description:
                          "Only for exact dates with limited results (fewer than 3, or stays hidden by bookings or a minimum stay). Windows shift check-in ±1–3 days (same length) or lengthen the stay to meet a minimum; only windows with more stays than the current search, best first, max 4. Counts honor your other filters.",
                        properties: {
                          currentCount: {
                            type: "integer",
                            description:
                              "Stays that fit the exact dates (equals count; at most 200 candidates).",
                          },
                          minStay: {
                            type: ["object", "null"],
                            description:
                              "Stays free on these dates but hidden only by a minimum stay.",
                            properties: {
                              count: { type: "integer" },
                              minNights: { type: "integer" },
                              message: {
                                type: "string",
                                example: "Some places need a 2-night minimum",
                              },
                            },
                          },
                          suggestions: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                checkIn: { type: "string", format: "date" },
                                checkOut: { type: "string", format: "date" },
                                nights: { type: "integer" },
                                shiftDays: { type: "integer" },
                                addedNights: { type: "integer" },
                                count: { type: "integer" },
                                label: {
                                  type: "string",
                                  example: "Nov 6–8 · 5 stays",
                                },
                                searchPath: { type: "string" },
                                searchUrl: {
                                  type: "string",
                                  description:
                                    "Marketplace search for this window; keeps every active filter, amenities included.",
                                },
                              },
                            },
                          },
                        },
                      },
                      docs: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": badSearchResponse,
          },
        },
      },
      "/api/v1/listings/{slug}": {
        get: {
          operationId: "getListing",
          summary: "Listing detail + availability",
          description:
            "Public listing for booking. Host email and phone are omitted. Street, postal code, and coordinates are included only when the listing shows a precise location to guests.",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "checkIn",
              in: "query",
              schema: { type: "string", format: "date" },
            },
            {
              name: "checkOut",
              in: "query",
              schema: { type: "string", format: "date" },
            },
            {
              name: "guests",
              in: "query",
              schema: { type: "integer" },
              description:
                "Party size for the quote (capped at maxGuests; default 1). Kept in bookUrl, capped the same way.",
            },
            {
              name: "pets",
              in: "query",
              schema: { type: "integer" },
              description: "Pets for the quote. Kept in bookUrl.",
            },
          ],
          responses: {
            "200": {
              description:
                "Listing detail. Only the pricing and link fields are listed here; listing also has title, description, location, rooms, rules, amenities, images and host.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", const: true },
                      version: { type: "string" },
                      listing: {
                        type: "object",
                        properties: {
                          slug: { type: "string" },
                          baseNightlyRate: { type: "number" },
                          cleaningFee: { type: "number" },
                          extraGuestFee: {
                            type: "number",
                            description:
                              "Per night for each guest beyond extraGuestsIncluded. 0 = no extra-guest fee.",
                          },
                          extraGuestsIncluded: {
                            type: "integer",
                            description: "Guests the base nightly rate covers.",
                          },
                          maxGuests: { type: "integer" },
                          url: { type: "string" },
                          bookUrl: {
                            type: "string",
                            description:
                              "Human booking page. Keeps checkIn/checkOut (when both are valid), guests and pets from the request.",
                          },
                          apiUrl: { type: "string" },
                          availability: {
                            type: "object",
                            properties: {
                              quote: {
                                type: ["object", "null"],
                                description:
                                  "Only when checkIn and checkOut are sent.",
                                properties: {
                                  nights: { type: "integer" },
                                  guests: {
                                    type: "integer",
                                    description:
                                      "Guests the quote is priced for (requested guests capped at maxGuests).",
                                  },
                                  nightlySubtotal: { type: "number" },
                                  extraGuests: {
                                    type: "integer",
                                    description:
                                      "Guests beyond extraGuestsIncluded: max(0, guests − extraGuestsIncluded), even when the listing's extraGuestFee is 0 (then the charge is 0).",
                                  },
                                  extraGuestFee: {
                                    type: "number",
                                    description:
                                      "Extra-guest charge for the whole stay; included in totalAmount.",
                                  },
                                  cleaningFee: { type: "number" },
                                  petFee: { type: "number" },
                                  discountAmount: { type: "number" },
                                  totalAmount: { type: "number" },
                                  depositAmount: { type: "number" },
                                  currency: { type: "string", const: "USD" },
                                  meetsMinNights: { type: "boolean" },
                                  error: { type: "string" },
                                },
                              },
                            },
                          },
                        },
                      },
                      docs: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": badDatesResponse,
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/listings/{slug}/availability": {
        get: {
          operationId: "getListingAvailability",
          summary: "Available windows + blocked ranges",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "nights",
              in: "query",
              schema: { type: "integer", minimum: 1 },
              description: "Stay length (default max(2, listing min nights))",
            },
            {
              name: "from",
              in: "query",
              schema: { type: "string", format: "date" },
              description: "Start of search horizon (default today)",
            },
            {
              name: "days",
              in: "query",
              schema: { type: "integer" },
              description: "Look-ahead days (default 90, max 180)",
            },
            {
              name: "maxWindows",
              in: "query",
              schema: { type: "integer" },
              description: "Max free windows to return (default 10)",
            },
          ],
          responses: {
            "200": { description: "Availability payload" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/stays/checkout": {
        post: {
          operationId: "createStayCheckout",
          summary: "Pay-first card checkout for a marketplace stay",
          description:
            "Creates a Stripe Checkout URL. No token required; rate limited per IP (10 per 15 minutes, 40 per day) and per guest email (5 per hour). Dates are not held: the calendar is written only after the card is paid. If another guest pays for overlapping nights first, this payment is refunded in full and the booking is cancelled. Sessions expire in 30 minutes. Agents must not send paid:true.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "slug",
                    "checkIn",
                    "checkOut",
                    "guestName",
                    "guestEmail",
                    "acceptTerms",
                  ],
                  properties: {
                    slug: { type: "string" },
                    checkIn: { type: "string", format: "date" },
                    checkOut: { type: "string", format: "date" },
                    guests: { type: "integer", minimum: 1 },
                    pets: { type: "integer", minimum: 0 },
                    guestName: { type: "string" },
                    guestEmail: { type: "string", format: "email" },
                    guestPhone: { type: "string" },
                    acceptTerms: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Checkout URL (calendar not held until paid)",
            },
            "400": { description: "Invalid request" },
            "404": { description: "Listing not on marketplace" },
            "409": {
              description:
                "Dates unavailable, or host not ready to take a card deposit (Stripe card onboarding not finished). Body: { ok: false, error, bookUrl } — send the guest to bookUrl (the human booking page for this stay) or have them message the host.",
            },
            "429": {
              description:
                "Too many checkout attempts. Body: { ok: false, error, code, limit: { name, max, windowSeconds }, retryAfterSeconds }. The Retry-After header gives the same seconds; wait that long before you send again.",
            },
          },
        },
      },
      "/api/v1/inquiries": {
        post: {
          operationId: "askHostQuestion",
          summary: "Ask a host a question before booking",
          description:
            "Sends a pre-booking question to the host of a marketplace listing, on behalf of a real person who wants the reply. No token required; AI agents are welcome. The host replies by email to guestEmail. Limits: per IP 5 per 10 minutes and 20 per day; per guest email 3 per hour and 10 per day; per listing 20 per hour; per host 60 per hour and 300 per day. Repeating the same (or nearly the same) question from the same email within 24 hours returns the existing inquiry with duplicate:true and nothing is re-sent. Messages with more than one link, links in the name or subject, HTML, link shorteners, or spam wording are rejected. Hosts and co-hosts get an email for every question right away; only during a flood (more than 10 emails to one host in 10 minutes) are later messages grouped into one email when that window ends.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["slug", "guestName", "guestEmail", "message"],
                  properties: {
                    slug: { type: "string", description: "Listing slug" },
                    guestName: { type: "string", maxLength: 80 },
                    guestEmail: {
                      type: "string",
                      format: "email",
                      description: "Where the host's reply goes",
                    },
                    guestPhone: { type: "string", maxLength: 40 },
                    subject: { type: "string", maxLength: 150 },
                    message: { type: "string", minLength: 5, maxLength: 2000 },
                    checkIn: { type: "string", format: "date" },
                    checkOut: { type: "string", format: "date" },
                    guests: { type: "integer", minimum: 1 },
                    agentName: {
                      type: "string",
                      maxLength: 80,
                      description:
                        "Name of the assistant sending this (shown to the host)",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description:
                "Sent: { ok, inquiryId, duplicate:false, hostNotification: emailed|queued|none }",
            },
            "200": {
              description:
                "Duplicate of a question this email already sent in the last 24 hours (duplicate:true, nothing re-sent)",
            },
            "400": { description: "Invalid request (missing or bad fields)" },
            "404": { description: "Listing not on marketplace" },
            "422": { description: "Rejected as spam or too many links" },
            "429": {
              description:
                "Rate limited. Body: { ok: false, error, code, limit: { name, max, windowSeconds }, retryAfterSeconds }. The Retry-After header gives the same seconds; wait that long before you send again. A duplicate (200, duplicate:true) does not count toward the per-IP limits.",
            },
          },
        },
      },
      "/api/v1/openapi.json": {
        get: {
          operationId: "getOpenApi",
          summary: "This OpenAPI document",
          responses: {
            "200": { description: "OpenAPI 3.1 JSON" },
          },
        },
      },
    },
    externalDocs: {
      description: "Agent instructions (llms.txt)",
      url: `${origin}/llms.txt`,
    },
  };
}
