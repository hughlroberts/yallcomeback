import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "./openapi";

describe("agent OpenAPI document", () => {
  it("documents checkout as public (no bearer security, no 401)", () => {
    const doc = buildOpenApiDocument("https://www.yallcomeback.app");
    const op = doc.paths["/api/v1/stays/checkout"].post as Record<string, unknown>;
    expect(op).not.toHaveProperty("security");
    expect(op.responses).not.toHaveProperty("401");
    expect(op.responses).toHaveProperty("429");
    expect(JSON.stringify(doc)).not.toMatch(/Bearer|agentToken|AGENT_API_TOKEN/);
  });

  it("uses OpenAPI 3.1 null types (no nullable) and documents the search 400", () => {
    const doc = buildOpenApiDocument("https://www.yallcomeback.app");
    const text = JSON.stringify(doc);
    expect(doc.openapi).toMatch(/^3\.1/);
    expect(text).not.toContain("nullable");
    const search = doc.paths["/api/v1/search"].get as {
      responses: Record<string, { content?: Record<string, { schema: { properties: Record<string, { type: unknown; properties?: Record<string, { type: unknown }> }> } }> }>;
    };
    const props = search.responses["200"].content!["application/json"].schema.properties;
    expect(props.flexibleDates.type).toEqual(["object", "null"]);
    expect(props.flexibleDates.properties!.minStay.type).toEqual(["object", "null"]);
    expect(props).toHaveProperty("returned");
    expect(search.responses).toHaveProperty("400");
  });
});
