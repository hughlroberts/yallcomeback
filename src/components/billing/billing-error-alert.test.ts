import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BillingErrorAlert } from "./BillingErrorAlert";

const CODES = [
  "stripe_off",
  "price_missing",
  "no_email",
  "forbidden",
  "has_subscription",
  "not_marketplace",
  "not_branded",
  "failed",
  "some_unknown_code",
];

const render = (code: string | null | undefined) =>
  renderToStaticMarkup(createElement(BillingErrorAlert, { code }));

describe("billingError box on /account/settings/subscription (T38c)", () => {
  it.each(CODES)("%s renders the readable alert box", (code) => {
    const html = render(code);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Billing did not open");
    const body = html.match(/<p class="mt-0.5">([^<]+)<\/p>/)?.[1] ?? "";
    expect(body.length).toBeGreaterThan(20);
    expect(body).toMatch(/\.$/);
    // Readable text, never the raw code.
    expect(body).not.toContain(code);
  });

  it("unknown codes say nothing changed", () => {
    expect(render("some_unknown_code")).toMatch(/Nothing changed/);
  });

  it("no code renders nothing", () => {
    expect(render(undefined)).toBe("");
    expect(render(null)).toBe("");
    expect(render("")).toBe("");
  });

  it("stays on screen: plain server markup, no toast, timer, or dismiss", () => {
    const html = render("failed");
    expect(html).not.toMatch(/<button|aria-live="polite"|data-toast/i);
    const comp = readFileSync("src/components/billing/BillingErrorAlert.tsx", "utf8");
    expect(comp).not.toMatch(/"use client"|setTimeout|useEffect|useState/);
  });

  it("the subscription page shows the box (not the FlashToast) for billingError", () => {
    const page = readFileSync("src/app/account/settings/subscription/page.tsx", "utf8");
    expect(page).toMatch(/billingError \? \([\s\S]{0,200}<BillingErrorAlert code=\{sp\.billingError\} \/>[\s\S]{0,40}\) : flash \?/);
  });
});
