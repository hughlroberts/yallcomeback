/**
 * T48: Platform admin actions refuse to invoice an internal / QA brand while
 * live Stripe keys are in use (server side, not only a disabled button).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  host: { findUnique: vi.fn(), update: vi.fn() },
}));
const billing = vi.hoisted(() => ({ createHostingInvoiceForHost: vi.fn(async () => ({})) }));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requirePlatformAdmin: vi.fn(async () => ({ user: { id: "admin" } })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
vi.mock("@/lib/platform-billing", () => ({
  cancelPlatformHostingSubscription: vi.fn(),
  pausePlatformHostingSubscription: vi.fn(),
}));
vi.mock("@/lib/hosting-billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hosting-billing")>()),
  createHostingInvoiceForHost: billing.createHostingInvoiceForHost,
}));

import { approveHost, issueHostingInvoice, setHostTestBrand } from "./hosting";

const LIVE = "sk_live_placeholder_not_a_real_key";
const TEST = "sk_test_placeholder_not_a_real_key";

const brand = (over: Record<string, unknown> = {}) => ({
  id: "h_qa",
  name: "QA Tester Two",
  slug: "qa-tester-two",
  planId: "plan_1",
  approvalStatus: "APPROVED",
  hostingMode: "PLATFORM",
  sitePresence: "CUSTOM",
  subscriptionStatus: "ACTIVE",
  stripeSubscriptionId: null,
  stripeSubscriptionStatus: null,
  isTestBrand: true,
  ...over,
});

function form(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.host.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...brand(),
    ...data,
  }));
});
afterEach(() => vi.unstubAllEnvs());

describe("Issue renewal invoice on a test brand", () => {
  it("live keys: redirects with the test-brand notice and never creates an invoice", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", LIVE);
    db.host.findUnique.mockResolvedValueOnce(brand());
    await expect(
      issueHostingInvoice(form({ hostId: "h_qa", planId: "plan_1", notes: "Renewal invoice" })),
    ).rejects.toMatchObject({ url: "/ops/hosting?invoiceSkipped=test&brand=qa-tester-two" });
    expect(billing.createHostingInvoiceForHost).not.toHaveBeenCalled();
  });

  it("test keys: the invoice is created as usual", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", TEST);
    db.host.findUnique.mockResolvedValueOnce(brand());
    await issueHostingInvoice(form({ hostId: "h_qa", planId: "plan_1" }));
    expect(billing.createHostingInvoiceForHost).toHaveBeenCalledTimes(1);
  });

  it("live keys, real brand: the invoice is created as usual", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", LIVE);
    db.host.findUnique.mockResolvedValueOnce(brand({ isTestBrand: false }));
    await issueHostingInvoice(form({ hostId: "h_qa", planId: "plan_1" }));
    expect(billing.createHostingInvoiceForHost).toHaveBeenCalledTimes(1);
  });
});

describe("Approve with 'issue first invoice' on a test brand", () => {
  it("live keys: approved, but no first invoice", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", LIVE);
    db.host.findUnique.mockResolvedValueOnce(brand({ approvalStatus: "PENDING_REVIEW" }));
    await expect(
      approveHost(form({ hostId: "h_qa", planId: "plan_1", issueInvoice: "on", hostingMode: "PLATFORM" })),
    ).rejects.toMatchObject({ url: "/ops/hosting?invoiceSkipped=test-approved&brand=qa-tester-two" });
    expect(db.host.update).toHaveBeenCalledTimes(1);
    expect(db.host.update.mock.calls[0][0].data.approvalStatus).toBe("APPROVED");
    expect(billing.createHostingInvoiceForHost).not.toHaveBeenCalled();
  });
});

describe("Mark / unmark test brand", () => {
  it("sets isTestBrand from the form", async () => {
    await setHostTestBrand(form({ hostId: "h_qa", isTestBrand: "1" }));
    expect(db.host.update).toHaveBeenLastCalledWith({ where: { id: "h_qa" }, data: { isTestBrand: true } });
    await setHostTestBrand(form({ hostId: "h_qa", isTestBrand: "0" }));
    expect(db.host.update).toHaveBeenLastCalledWith({ where: { id: "h_qa" }, data: { isTestBrand: false } });
  });
});

describe("T50: a failed invoice shows a notice, not an error page", () => {
  it("issueHostingInvoice: create fails, redirect to invoiceSkipped=failed (brand not touched here)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", TEST);
    db.host.findUnique.mockResolvedValue(brand({ isTestBrand: false }));
    billing.createHostingInvoiceForHost.mockRejectedValueOnce(new Error("stripe down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(issueHostingInvoice(form({ hostId: "h_qa" }))).rejects.toMatchObject({
      url: "/ops/hosting?invoiceSkipped=failed&brand=qa-tester-two",
    });
    expect(db.host.update).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledWith("[hosting-invoice] invoice not created", expect.objectContaining({ brand: "qa-tester-two" }));
    err.mockRestore();
  });

  it("T50b: a $0 invoice on a paid plan is refused, redirect to invoiceSkipped=zero (brand not touched)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", TEST);
    db.host.findUnique.mockResolvedValue(brand({ isTestBrand: false }));
    const { HostingInvoiceRefusedError } = await import("@/lib/hosting-billing");
    billing.createHostingInvoiceForHost.mockRejectedValueOnce(
      new HostingInvoiceRefusedError("came to $0"),
    );
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(issueHostingInvoice(form({ hostId: "h_qa" }))).rejects.toMatchObject({
      url: "/ops/hosting?invoiceSkipped=zero&brand=qa-tester-two",
    });
    expect(db.host.update).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
