import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "./agent/openapi";
import {
  brandedPriceLabel,
  marketplacePriceWithCardLabel,
  setupServicePriceLabel,
} from "./hosting-prices";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// T46: older docs use the current price wording.
const DOC_FILES = [
  "src/lib/features.ts",
  "src/lib/help.ts",
  "src/lib/agent/openapi.ts",
  "src/app/open-source/page.tsx",
  "src/app/self-host/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/llms.txt/route.ts",
  "src/app/agents.md/route.ts",
  "src/app/help/syndication-api-key/page.tsx",
  "src/components/help/help-articles.tsx",
  "docs/remote-open-source-marketplace.md",
];
// Root *.md files are left out of the Docker build context (.dockerignore),
// and the image runs vitest. Check them only when they are present.
const ROOT_DOC_FILES = ["AGENTS.md"];
const OLD = [
  /\$12 per\s+(published\s+)?listing\s*\/\s*month/,
  /\$12 \/ (published )?listing \/ month/,
  /\$12\/listing/,
  /\$12 USD per published listing/,
  /\$\{MARKETPLACE_LISTING_USD\} (USD )?(per|\/) published listing/,
  /\$500 full setup/,
  /full setup \(\$500\)/,
  /\$25 \/ month/,
];

describe("price wording (T46)", () => {
  it("labels render the current wording", () => {
    expect(marketplacePriceWithCardLabel()).toBe("$12/mo per listing + card processing");
    expect(brandedPriceLabel()).toBe("$25/mo + $1.06/mo card processing");
    expect(setupServicePriceLabel()).toBe("$500 one-time + $15.25 card processing");
  });

  it.each(DOC_FILES)("%s has no old price wording", (file) => {
    const src = read(file);
    for (const re of OLD) expect(src, `${file} ${re}`).not.toMatch(re);
  });

  it.each(ROOT_DOC_FILES)("%s has no old price wording (when present)", (file) => {
    if (!existsSync(join(process.cwd(), file))) return;
    const src = read(file);
    for (const re of OLD) expect(src, `${file} ${re}`).not.toMatch(re);
  });

  it("OpenAPI description uses the marketplace label", () => {
    const doc = buildOpenApiDocument("https://qa.example.test");
    expect(doc.info.description).toContain(marketplacePriceWithCardLabel());
    expect(doc.info.description).toContain(brandedPriceLabel());
  });
});
