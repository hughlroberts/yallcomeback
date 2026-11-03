/** T48: Platform admin > hosting invoice button for test brands. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  HostingInvoiceButton,
  TEST_BRAND_INVOICE_OFF_NOTICE,
  TestBrandToggle,
} from "./hosting-invoice-button";

const action = async () => {};

function render(blocked: boolean) {
  return renderToStaticMarkup(
    createElement(HostingInvoiceButton, {
      action,
      hostId: "h_qa",
      planId: "plan_1",
      notes: "Renewal invoice",
      label: "Issue renewal invoice",
      blocked,
    }),
  );
}

describe("Issue renewal invoice button", () => {
  it("blocked (test brand + live keys): disabled button, notice, no form", () => {
    const html = render(true);
    expect(html).toContain('data-testid="test-brand-invoice-off"');
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Issue renewal invoice<\/button>/);
    expect(html).toContain(TEST_BRAND_INVOICE_OFF_NOTICE);
    expect(html).not.toContain("<form");
    expect(html).not.toContain('name="hostId"');
  });

  it("not blocked: a form with hostId and an enabled submit button", () => {
    const html = render(false);
    expect(html).toContain("<form");
    expect(html).toContain('name="hostId" value="h_qa"');
    expect(html).toContain('name="notes" value="Renewal invoice"');
    expect(html).not.toMatch(/\sdisabled=""/);
    expect(html).not.toContain(TEST_BRAND_INVOICE_OFF_NOTICE);
  });
});

describe("Test brand toggle", () => {
  const t = (isTestBrand: boolean, liveKeys: boolean) =>
    renderToStaticMarkup(createElement(TestBrandToggle, { action, hostId: "h_qa", isTestBrand, liveKeys }));
  it("offers the opposite value", () => {
    expect(t(false, true)).toContain('name="isTestBrand" value="1"');
    expect(t(false, true)).toContain("Mark as test brand");
    expect(t(true, true)).toContain('name="isTestBrand" value="0"');
    expect(t(true, true)).toContain("Unmark test brand");
  });
  it("says whether invoices are off right now", () => {
    expect(t(true, true)).toContain("invoices and charges are off");
    expect(t(true, false)).toContain("invoices still work");
  });
});
