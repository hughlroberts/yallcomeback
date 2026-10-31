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
});
