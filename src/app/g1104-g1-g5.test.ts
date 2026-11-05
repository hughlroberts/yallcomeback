import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "@/lib/agent/openapi";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("G1 availability shares quote min-stay logic", () => {
  it("findAvailableWindows uses requiredMinNights", () => {
    const avail = src("lib/agent/availability.ts");
    expect(avail).toMatch(/requiredMinNights/);
    expect(avail).toMatch(/from \"@\/lib\/flexible-dates\"/);
  });
});

describe("G5 availability days cap documented", () => {
  it("openapi days param and 200 schema mention days_capped / warnings", () => {
    const doc = buildOpenApiDocument("https://example.test") as unknown as {
      paths: Record<
        string,
        {
          get: {
            parameters: { name: string; description?: string }[];
            responses: {
              "200": {
                description?: string;
                content?: {
                  "application/json": {
                    schema: {
                      properties: {
                        warnings?: { items?: { properties?: { code?: { enum?: string[] } } } };
                        note?: unknown;
                      };
                    };
                  };
                };
              };
            };
          };
        }
      >;
    };
    const path = doc.paths["/api/v1/listings/{slug}/availability"].get;
    const days = path.parameters.find((p) => p.name === "days");
    expect(days?.description).toMatch(/days_capped|capped at 180/i);
    expect(path.responses["200"].description).toMatch(/warnings|capped/i);
    const props =
      path.responses["200"].content!["application/json"].schema.properties;
    expect(props.note).toBeTruthy();
    expect(props.warnings?.items?.properties?.code?.enum).toContain(
      "days_capped",
    );
  });
});

describe("G2 host tap targets ≥24px", () => {
  it("See all / Read more / Terms / Privacy / about email use min-h-6", () => {
    const home = src("app/h/[hostSlug]/page.tsx");
    expect(home).toMatch(/min-h-6[\s\S]{0,200}See all/);
    expect(home).toMatch(/min-h-6[\s\S]{0,200}Read more/);
    const footer = src("components/host-site-footer.tsx");
    expect(footer).toMatch(/min-h-6[\s\S]{0,120}Terms/);
    expect(footer).toMatch(/min-h-6[\s\S]{0,120}Privacy/);
    const about = src("app/h/[hostSlug]/about/page.tsx");
    expect(about).toMatch(
      /mailto:\$\{host\.contactEmail\}[\s\S]{0,120}min-h-6|min-h-6[\s\S]{0,120}mailto:\$\{host\.contactEmail\}/,
    );
  });
});

describe("G3 /book print styles", () => {
  it("book page marks print root and message form no-print; globals hide chrome", () => {
    const book = src("app/book/[slug]/page.tsx");
    expect(book).toMatch(/data-book-print/);
    expect(book).toMatch(/className="no-print /);
    expect(book).toMatch(/Message the host\?/);
    const css = src("app/globals.css");
    expect(css).toMatch(/G3: \/book print/);
    expect(css).toMatch(/body:has\(\[data-book-print\]\) header/);
    expect(css).toMatch(/body:has\(\[data-book-print\]\) nav/);
    expect(css).toMatch(/body:has\(\[data-book-print\]\) footer/);
  });
});

describe("F2 mailto target unchanged on brand about", () => {
  it("still uses mailto:${host.contactEmail}", () => {
    expect(src("app/h/[hostSlug]/about/page.tsx")).toContain(
      "mailto:${host.contactEmail}",
    );
  });
});
