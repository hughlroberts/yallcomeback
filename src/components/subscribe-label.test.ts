import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SUBSCRIBE_CHECKOUT_LABEL } from "@/lib/billing-labels";
import { BrandedPendingBanner } from "./branded-pending-banner";
import { MarketplaceCardBanner } from "./marketplace-card-banner";

function button(html: string): string {
  const m = html.match(/<button[^>]*>([^<]*)<\/button>/);
  return m ? m[1] : "";
}

describe("one label for starting the subscription checkout (T46)", () => {
  it("is Add card and subscribe", () => {
    expect(SUBSCRIBE_CHECKOUT_LABEL).toBe("Add card and subscribe");
  });

  it("Marketplace banner (grace and hidden) uses it", () => {
    for (const state of [
      { kind: "grace", endsAt: new Date("2026-11-17T12:00:00Z"), daysLeft: 14 },
      { kind: "suspended", since: new Date("2026-11-01T12:00:00Z") },
    ]) {
      const html = renderToStaticMarkup(
        createElement(MarketplaceCardBanner, {
          hostId: "h1",
          hostName: "QA Marketplace Test",
          state: state as never,
        }),
      );
      expect(button(html)).toBe(SUBSCRIBE_CHECKOUT_LABEL);
      expect(html).not.toMatch(/Add a card|>Add card</);
    }
  });

  it("Branded waiting-for-payment banner uses it", () => {
    const html = renderToStaticMarkup(
      createElement(BrandedPendingBanner, { hostId: "h1", hostName: "QA Branded Test" }),
    );
    expect(button(html)).toBe(SUBSCRIBE_CHECKOUT_LABEL);
  });

  it("billing card has no other wording for the same action", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/account/settings/subscription/page.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/"Add a card"|"Add card"|"Add card and subscribe"/);
    expect(src).toContain("SUBSCRIBE_CHECKOUT_LABEL");
    // The portal button for a brand with a card stays distinct.
    expect(src).toContain("UPDATE_CARD_LABEL");
  });
});
