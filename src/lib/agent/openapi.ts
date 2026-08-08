/** OpenAPI 3.1 document for the public agent API (served at /api/v1/openapi.json). */

export function buildOpenApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Yall Come Back Agent API",
      version: "1.0.0",
      description:
        "Public JSON API for AI agents to search vacation rentals with exact or flexible dates, read listing details, and deep-link guests into booking. No auth required for read endpoints.",
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
