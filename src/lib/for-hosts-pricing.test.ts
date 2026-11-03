import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MARKETPLACE_PLAN_DESCRIPTION,
  marketplacePriceWithCardLabel,
  planPublicDescription,
  setupServicePriceLabel,
} from "./hosting-prices";
import { forHostsServiceJsonLd } from "./json-ld";

// T47. Only src/ files are read here: .dockerignore drops root *.md, and the
// Docker build runs vitest.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const OLD = /per published listing|published listing \/ month|\$12 \/ (published )?listing/;
const LABEL = "$12/mo per listing + card processing";

describe("/for-hosts JSON-LD (T47)", () => {
  it("Marketplace offer uses the shared label", () => {
    const ld = forHostsServiceJsonLd({
      origin: "https://qa.example.test",
      url: "https://qa.example.test/for-hosts",
      description: "x",
    }) as { offers: { name: string; description: string }[] };
    const offer = ld.offers.find((o) => o.name === "Marketplace listing")!;
    expect(offer.description).toBe(`${marketplacePriceWithCardLabel()}. Not a booking commission.`);
    expect(JSON.stringify(ld)).not.toMatch(OLD);
  });
});

describe("plan-picker descriptions (T47)", () => {
  const stored = [
    "$12 per published listing per month. List on Find a Place. Not a booking commission.",
    "$12 per published listing / month. List on Find a Place. Not a booking commission.",
    "$12 / published listing / month — List on Find a Place. Not a booking commission.",
    "$12 USD per published listing per month. List on Find a Place. Not a booking commission.",
    MARKETPLACE_PLAN_DESCRIPTION,
  ];
  it.each(stored)("rewrites old stored text: %s", (description) => {
    const out = planPublicDescription({ pricingModel: "PER_PROPERTY", monthlyPrice: 12, description })!;
    expect(out).toBe(`${LABEL}. List on Find a Place.${description.includes("No custom") ? " No custom brand website." : ""} Not a booking commission.`);
    expect(out).not.toMatch(OLD);
  });
  it("uses the plan amount", () => {
    expect(planPublicDescription({ pricingModel: "PER_PROPERTY", monthlyPrice: 15, description: null })).toBe(
      "$15/mo per listing + card processing",
    );
  });
  it("default description starts with the label", () => {
    expect(MARKETPLACE_PLAN_DESCRIPTION.startsWith(LABEL)).toBe(true);
  });
});

describe("full setup price text (T47)", () => {
  it("signup checkbox uses the dynamic label", () => {
    const s = read("src/components/HostSignupForm.tsx");
    expect(s).toContain("{setupServicePriceLabel(SETUP_SERVICE_FEE_USD)}");
    expect(s).not.toMatch(/formatMoney\(SETUP_SERVICE_FEE_USD\)\}\{" "\}\s*one-time/);
    expect(s).not.toMatch(/\$12\/mo per listing \+ card processing/);
    expect(setupServicePriceLabel(500)).toBe("$500 one-time + $15.25 card processing");
  });
  it("/for-hosts setup cards show the card amount", () => {
    const s = read("src/app/for-hosts/page.tsx");
    expect(s).not.toContain("one-time + card processing");
    expect(s).toContain("cardProcessingUsd(SETUP_SERVICE_FEE_USD)");
  });
});

describe("tests run inside the Docker build", () => {
  it("no test reads a root .md file without an exists check", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.test\.tsx?$/.test(n)) files.push(p);
      }
    };
    walk(join(process.cwd(), "src"));
    const bad = files.filter((f) => {
      const s = readFileSync(f, "utf8");
      return /["'`][A-Za-z0-9_-]+\.md["'`]/.test(s) && !s.includes("existsSync");
    });
    expect(bad).toEqual([]);
  });
});
