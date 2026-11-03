/**
 * T48: no admin invoice or charge for internal / QA brands while live Stripe
 * keys are in use. Keys here are fake placeholders, never real secrets.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  host: { findUnique: vi.fn(), update: vi.fn() },
  hostingPlan: { findUnique: vi.fn() },
  hostingInvoice: { create: vi.fn() },
  property: { count: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import {
  assertTestBrandBillingAllowed,
  stripeLiveKeyInUse,
  TEST_BRAND_LIVE_BILLING_ERROR,
  testBrandBillingBlocked,
} from "@/lib/test-brand-billing";
import { createHostingInvoiceForHost } from "@/lib/hosting-billing";
import { invoiceSkippedNotice } from "@/lib/hosting-billing-notice";

const LIVE = "sk_live_placeholder_not_a_real_key";
const TEST = "sk_test_placeholder_not_a_real_key";

const qaBrand = {
  id: "h_qa",
  name: "QA Marketplace Test",
  slug: "qa-marketplace-test",
  planId: null,
  hostingMode: "PLATFORM",
  sitePresence: "STAYLOCAL",
  stripeSubscriptionId: null,
  stripeSubscriptionStatus: null,
  isTestBrand: true,
  users: [],
  plan: null,
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("live Stripe key detection", () => {
  it("sk_live_ and rk_live_ are live; sk_test_, empty and unset are not", () => {
    expect(stripeLiveKeyInUse({ STRIPE_SECRET_KEY: LIVE })).toBe(true);
    expect(stripeLiveKeyInUse({ STRIPE_SECRET_KEY: " rk_live_x " })).toBe(true);
    expect(stripeLiveKeyInUse({ STRIPE_SECRET_KEY: TEST })).toBe(false);
    expect(stripeLiveKeyInUse({ STRIPE_SECRET_KEY: "" })).toBe(false);
    expect(stripeLiveKeyInUse({})).toBe(false);
  });

  it("blocked only for a test brand AND a live key", () => {
    const live = { STRIPE_SECRET_KEY: LIVE };
    const test = { STRIPE_SECRET_KEY: TEST };
    expect(testBrandBillingBlocked({ isTestBrand: true }, live)).toBe(true);
    expect(testBrandBillingBlocked({ isTestBrand: true }, test)).toBe(false);
    expect(testBrandBillingBlocked({ isTestBrand: false }, live)).toBe(false);
    expect(testBrandBillingBlocked({ isTestBrand: null }, live)).toBe(false);
    expect(testBrandBillingBlocked({}, live)).toBe(false);
  });

  it("the guard error never includes the key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", LIVE);
    expect(() => assertTestBrandBillingAllowed({ isTestBrand: true })).toThrow(
      TEST_BRAND_LIVE_BILLING_ERROR,
    );
    try {
      assertTestBrandBillingAllowed({ isTestBrand: true });
    } catch (e) {
      expect(String((e as Error).message)).not.toContain("sk_live");
    }
  });
});

describe("createHostingInvoiceForHost (renewal invoice) server-side guard", () => {
  it("test brand + live keys: refused before any plan lookup, invoice write or Stripe call", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", LIVE);
    db.host.findUnique.mockResolvedValueOnce(qaBrand);
    await expect(
      createHostingInvoiceForHost({ hostId: "h_qa", planId: "plan_1", notes: "Renewal invoice" }),
    ).rejects.toThrow(TEST_BRAND_LIVE_BILLING_ERROR);
    expect(db.hostingPlan.findUnique).not.toHaveBeenCalled();
    expect(db.hostingInvoice.create).not.toHaveBeenCalled();
    expect(db.host.update).not.toHaveBeenCalled();
  });

  it("test brand + test keys: guard lets it through (normal checks run)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", TEST);
    db.host.findUnique.mockResolvedValueOnce(qaBrand);
    await expect(createHostingInvoiceForHost({ hostId: "h_qa" })).rejects.toThrow(
      "Assign a hosting plan first",
    );
  });

  it("real brand + live keys: guard lets it through", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", LIVE);
    db.host.findUnique.mockResolvedValueOnce({ ...qaBrand, isTestBrand: false });
    await expect(createHostingInvoiceForHost({ hostId: "h_qa" })).rejects.toThrow(
      "Assign a hosting plan first",
    );
  });
});

describe("admin notice after a refused invoice", () => {
  it("names the brand and says why", () => {
    expect(invoiceSkippedNotice("test", "QA Tester Two")).toBe(
      "No invoice was sent: QA Tester Two is a test brand and live Stripe keys are in use, so invoices and charges are off for it.",
    );
    expect(invoiceSkippedNotice("test-approved", "QA Tester Two")).toMatch(
      /^QA Tester Two is approved\. No invoice was sent: QA Tester Two is a test brand/,
    );
  });
});
