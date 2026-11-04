import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "./openapi";
import { CONNECT_GATE_MESSAGES } from "@/lib/connect-readiness";

const CODES409 = ["connect_no_account", "connect_details_not_submitted", "connect_charges_not_enabled"];
const doc = buildOpenApiDocument("https://www.yallcomeback.app") as unknown as {
  paths: Record<string, { post: { responses: Record<string, { description: string }> } }>;
};
const r = doc.paths["/api/v1/stays/checkout"].post.responses;
const root = path.resolve(__dirname, "../../app");

describe("T61c: checkout error codes are documented", () => {
  it("openapi 409 lists code and every connect_* value; 503 documents connect_status_unavailable", () => {
    expect(r["409"].description).toContain("{ ok: false, error, code?, bookUrl }");
    for (const c of CODES409) expect(r["409"].description).toContain(c);
    expect(r["503"].description).toContain("connect_status_unavailable");
  });
  it("documented codes are exactly the codes the gate returns", () => {
    expect(Object.keys(CONNECT_GATE_MESSAGES).sort()).toEqual([...CODES409, "connect_status_unavailable"].sort());
  });
  it("llms.txt and agents.md list the codes and the 503", () => {
    for (const f of ["llms.txt/route.ts", "agents.md/route.ts"]) {
      const s = readFileSync(path.join(root, f), "utf8");
      for (const c of [...CODES409, "connect_status_unavailable"]) expect(s).toContain(c);
      expect(s).toContain("503");
    }
  });
});

describe("T61c docs sentence joins", () => {
  it("no sentence starts lowercase after a period in the checkout error text", () => {
    for (const f of ["llms.txt/route.ts", "agents.md/route.ts"]) {
      const s = readFileSync(path.join(path.resolve(__dirname, "../../app"), f), "utf8");
      expect(s).not.toMatch(/\. with \\`code\\`/);
      expect(s).toContain("When the host's payments are not ready, the 409 also includes \\`code\\`: connect_no_account");
    }
  });
});
