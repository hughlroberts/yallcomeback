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

describe("T56: docs say pets 0 to 4", () => {
  it("OpenAPI pets params say 0 to 4, never 10", () => {
    const json = JSON.stringify(doc);
    expect(json).not.toMatch(/0 to 10|0–10/);
    type P = { name: string; description?: string; schema?: { maximum?: number } };
    const ops = {
      "/api/v1/search": doc.paths["/api/v1/search"].get,
      "/api/v1/listings/{slug}": doc.paths["/api/v1/listings/{slug}"].get,
    };
    for (const [path, op] of Object.entries(ops)) {
      const pets = (op.parameters as P[]).find((x) => x.name === "pets")!;
      expect(`${pets.description} ${JSON.stringify(pets.schema ?? {})}`, path).toMatch(/0 to 4|0–4|"maximum":4/);
    }
  });
  it("T56b: every pets schema in openapi.json (params and request bodies) is min 0 / max 4", () => {
    const found: { at: string; schema: { minimum?: number; maximum?: number } }[] = [];
    const walk = (node: unknown, at: string) => {
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (o.name === "pets" && o.schema) found.push({ at, schema: o.schema as never });
      const props = o.properties as Record<string, unknown> | undefined;
      if (props && typeof props.pets === "object") found.push({ at: `${at}.properties`, schema: props.pets as never });
      for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`);
    };
    walk(doc, "doc");
    expect(found.some((f) => f.at.includes("requestBody"))).toBe(true);
    expect(found.length).toBeGreaterThanOrEqual(3);
    for (const f of found) {
      expect(f.schema.minimum, f.at).toBe(0);
      expect(f.schema.maximum, f.at).toBe(4);
    }
  });
  it.each(["llms.txt/route.ts", "agents.md/route.ts"])("%s says 0 to 4", (p) => {
    const text = readFileSync(path.resolve(__dirname, "../../app", p), "utf8");
    expect(text).toMatch(/pets[^\n]*0 (to|–) ?4|pets must be 0–4/);
    expect(text).not.toMatch(/pets[^\n]*0 to 10/);
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
