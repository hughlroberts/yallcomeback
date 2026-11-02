import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildOpenApiDocument } from "./openapi";

type Schema = {
  type?: unknown;
  description?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
};
type Op = {
  parameters?: { name: string; description?: string }[];
  responses: Record<string, { content?: Record<string, { schema: Schema }> }>;
};

const doc = buildOpenApiDocument("https://www.yallcomeback.app");
const ok = (op: Op) => op.responses["200"].content!["application/json"].schema;

describe("OpenAPI documents the extra-guest fields", () => {
  it("search listings: fee settings, priceEstimate.extraGuestFee, bookUrl", () => {
    const item = ok(doc.paths["/api/v1/search"].get as Op).properties!.listings
      .items!.properties!;
    expect(item.extraGuestFee.type).toBe("number");
    expect(item.extraGuestsIncluded.type).toBe("integer");
    expect(item.priceEstimate.type).toEqual(["object", "null"]);
    expect(item.priceEstimate.properties!.extraGuestFee.description).toMatch(
      /totalBeforeTax/,
    );
    expect(item.bookUrl.description).toMatch(/guests and pets/);
  });

  it("listing detail: fee settings, quote guests/extraGuests/extraGuestFee, bookUrl", () => {
    const op = doc.paths["/api/v1/listings/{slug}"].get as Op;
    const listing = ok(op).properties!.listing.properties!;
    expect(listing.extraGuestFee.type).toBe("number");
    expect(listing.extraGuestsIncluded.type).toBe("integer");
    expect(listing.bookUrl.description).toMatch(/guests and pets/);
    const quote = listing.availability.properties!.quote;
    expect(quote.type).toEqual(["object", "null"]);
    expect(quote.properties!.guests.type).toBe("integer");
    expect(quote.properties!.extraGuests.type).toBe("integer");
    expect(quote.properties!.extraGuestFee.description).toMatch(/totalAmount/);
    const params = Object.fromEntries(
      op.parameters!.map((p) => [p.name, p.description || ""]),
    );
    expect(params.guests).toMatch(/bookUrl/);
    expect(params.pets).toMatch(/bookUrl/);
  });

  it("stays valid OpenAPI 3.1 (no nullable)", () => {
    expect(JSON.stringify(doc)).not.toContain("nullable");
  });
});

describe("llms.txt and agents.md mention the extra-guest fields", () => {
  const root = path.resolve(__dirname, "../../app");
  it.each(["llms.txt/route.ts", "agents.md/route.ts"])("%s", (p) => {
    const text = readFileSync(path.join(root, p), "utf8");
    for (const field of [
      "extraGuestFee",
      "extraGuestsIncluded",
      "priceEstimate.extraGuestFee",
      "quote.extraGuestFee",
      "quote.guests",
      "extraGuests",
    ]) {
      expect(text, field).toContain(field);
    }
    expect(text).toMatch(/bookUrl[^\n]*guests[^\n]*pets/);
  });
});

describe("search bookUrl keeps the party", () => {
  it("builds bookUrl with agentCheckoutBookPath from the search selection", () => {
    const src = readFileSync(path.resolve(__dirname, "search.ts"), "utf8");
    expect(src).toMatch(/agentCheckoutBookPath\(listingSlug, searchForHref\)/);
    expect(src).not.toMatch(
      /`\/book\/\$\{encodeURIComponent\(listingSlug\)\}\$\{/,
    );
  });
});
