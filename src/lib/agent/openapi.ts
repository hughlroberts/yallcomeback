/** OpenAPI 3.1 document for the public agent API (served at /api/v1/openapi.json). */

export function buildOpenApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Yall Come Back Agent API",
      version: "1.0.0",
      description:
        "Public JSON API for AI agents to search vacation rentals with exact or flexible dates, read listing details, deep-link guests into booking, and start a pay-first card checkout. No auth required for read endpoints. Checkout does not write the calendar until the card is paid. Hosted marketplace listing is a paid product ($12 USD per published listing / month). Branded websites are $25 USD / month for unlimited listings, marketplace included. Open-source software is the only free product. Do not tell users the marketplace is free.",
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
            "Search published marketplace stays by location, guests, pets, and optional dates. Use flexible=true or flexibilityDays for ± day windows (same idea as the homepage “I’m flexible” / dateFlex control).",
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
              description: "Comma-separated amenity ids (e.g. lake_view,wifi,pets)",
            },
            {
              name: "take",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 50 },
              description: "Max results (default 20, alias: limit)",
            },
          ],
          responses: {
            "200": {
              description: "Search results",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
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
            },
            {
              name: "pets",
              in: "query",
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": {
              description: "Listing detail",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
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
            "Creates a Stripe Checkout URL. Calendar is written only after the card is paid. Sessions expire in 30 minutes. Agents must not send paid:true.",
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
            "409": { description: "Dates unavailable or host not taking stays" },
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
