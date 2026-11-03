/**
 * T46 follow-up: what the brand sees on Settings > Subscription for the $500
 * full setup add-on, per setup status. INVOICED must not offer the card
 * button (so an invoiced brand cannot also pay $515.25 by card).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/messaging", () => ({ dispatchPlatformEmail: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ requireStripeClient: vi.fn() }));
vi.mock("@/lib/notification-prefs", () => ({ canSendEmailTo: vi.fn() }));
vi.mock("@/lib/platform-billing", () => ({
  HostingBillingError: class extends Error {},
  ensurePlatformCustomer: vi.fn(),
  stripeObjectId: vi.fn(),
}));

import { SetupServiceCard } from "./setup-service-card";

function render(setupServiceStatus: string, stripeOn = true) {
  return renderToStaticMarkup(
    createElement(SetupServiceCard, {
      hostId: "h1",
      hostName: "QA Marketplace Test",
      setupServiceStatus,
      stripeOn,
      anchor: true,
    }),
  );
}

describe("Full setup card on the subscription page", () => {
  it("INVOICED: says pay the invoice; no card form, no Buy button", () => {
    const html = render("INVOICED");
    expect(html).toContain('data-testid="setup-invoiced"');
    expect(html).toContain("We already sent you an invoice for full setup. Pay that invoice.");
    expect(html).not.toContain("<form");
    expect(html).not.toContain('value="setup"');
    expect(html).not.toContain("Buy full setup");
    expect(html).not.toContain('data-testid="setup-done"');
  });

  it("NONE and REQUESTED: one form posting intent=setup with Buy full setup", () => {
    for (const status of ["NONE", "REQUESTED"]) {
      const html = render(status);
      expect(html.match(/<form/g)).toHaveLength(1);
      expect(html).toContain('name="intent" value="setup"');
      expect(html).toContain('name="hostId" value="h1"');
      expect(html).toContain("Buy full setup");
      expect(html).not.toContain('data-testid="setup-invoiced"');
    }
    expect(render("REQUESTED")).toContain("You asked for full setup when you signed up.");
  });

  it("PAID and WAIVED: done text, no form", () => {
    expect(render("PAID")).toContain("Setup purchased, we&#x27;ll contact you.");
    expect(render("WAIVED")).toContain("Full setup is included for this brand.");
    for (const status of ["PAID", "WAIVED"]) {
      expect(render(status)).toContain('data-testid="setup-done"');
      expect(render(status)).not.toContain("<form");
    }
  });

  it("Stripe off: the Buy button is disabled", () => {
    expect(render("NONE", false)).toMatch(/<button[^>]*disabled/);
  });
});
