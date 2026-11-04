import { beforeEach, describe, expect, it, vi } from "vitest";

const stripe = vi.hoisted(() => ({ retrieveConnectStatus: vi.fn() }));
vi.mock("@/lib/stripe-connect", () => stripe);

import {
  checkBrandConnectReady,
  clearConnectReadyCache,
  CONNECT_READY_CACHE_MS,
} from "./connect-readiness";

const ready = { accountId: "acct_A", onboardingComplete: true, readyToProcessPayments: true };

beforeEach(() => {
  vi.clearAllMocks();
  clearConnectReadyCache();
});

describe("T61 brand Connect gate (mocked Stripe, no charges)", () => {
  it("no account id: 409 connect_no_account, no Stripe call", async () => {
    const r = await checkBrandConnectReady({ stripeAccountId: null });
    expect(r).toMatchObject({ ok: false, status: 409, code: "connect_no_account" });
    if (!r.ok) expect(r.error).toContain("/admin/payments");
    expect(stripe.retrieveConnectStatus).not.toHaveBeenCalled();
  });

  it("details not submitted: 409", async () => {
    stripe.retrieveConnectStatus.mockResolvedValue({ ...ready, onboardingComplete: false, readyToProcessPayments: false });
    const r = await checkBrandConnectReady({ stripeAccountId: "acct_A" });
    expect(r).toMatchObject({ ok: false, status: 409, code: "connect_details_not_submitted" });
    if (!r.ok) expect(r.error).toContain("/admin/payments");
  });

  it("charges not enabled: 409", async () => {
    stripe.retrieveConnectStatus.mockResolvedValue({ ...ready, readyToProcessPayments: false });
    const r = await checkBrandConnectReady({ stripeAccountId: "acct_A" });
    expect(r).toMatchObject({ ok: false, status: 409, code: "connect_charges_not_enabled" });
  });

  it("Stripe unreachable: fails closed with 503", async () => {
    stripe.retrieveConnectStatus.mockRejectedValue(new Error("ECONNRESET"));
    const r = await checkBrandConnectReady({ stripeAccountId: "acct_A" });
    expect(r).toMatchObject({ ok: false, status: 503, code: "connect_status_unavailable" });
  });

  it("ready: ok on the brand's own account id", async () => {
    stripe.retrieveConnectStatus.mockResolvedValue(ready);
    expect(await checkBrandConnectReady({ stripeAccountId: "acct_A" })).toEqual({ ok: true, accountId: "acct_A" });
    expect(stripe.retrieveConnectStatus).toHaveBeenCalledWith("acct_A");
  });

  it("caches only READY briefly; not-ready and errors never cached", async () => {
    stripe.retrieveConnectStatus.mockResolvedValueOnce({ ...ready, readyToProcessPayments: false });
    await checkBrandConnectReady({ stripeAccountId: "acct_A" }, 0);
    stripe.retrieveConnectStatus.mockRejectedValueOnce(new Error("x"));
    await checkBrandConnectReady({ stripeAccountId: "acct_A" }, 1);
    stripe.retrieveConnectStatus.mockResolvedValueOnce(ready);
    expect((await checkBrandConnectReady({ stripeAccountId: "acct_A" }, 2)).ok).toBe(true);
    expect(stripe.retrieveConnectStatus).toHaveBeenCalledTimes(3);
    expect((await checkBrandConnectReady({ stripeAccountId: "acct_A" }, 3)).ok).toBe(true);
    expect(stripe.retrieveConnectStatus).toHaveBeenCalledTimes(3);
    stripe.retrieveConnectStatus.mockResolvedValueOnce({ ...ready, readyToProcessPayments: false });
    const r = await checkBrandConnectReady({ stripeAccountId: "acct_A" }, 3 + CONNECT_READY_CACHE_MS + 1);
    expect(r).toMatchObject({ ok: false, code: "connect_charges_not_enabled" });
    expect(stripe.retrieveConnectStatus).toHaveBeenCalledTimes(4);
  });

  it("per brand: another brand's ready account never satisfies this one", async () => {
    stripe.retrieveConnectStatus.mockImplementation(async (id: string) =>
      id === "acct_OTHER" ? ready : { ...ready, onboardingComplete: false, readyToProcessPayments: false },
    );
    expect((await checkBrandConnectReady({ stripeAccountId: "acct_OTHER" })).ok).toBe(true);
    expect(await checkBrandConnectReady({ stripeAccountId: "acct_LAKE" })).toMatchObject({ ok: false, code: "connect_details_not_submitted" });
  });
});
