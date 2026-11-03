/**
 * T46 follow-up (Tester): a duplicate click on "Buy full setup" ($500 +
 * $15.25 card processing = $515.25) and the "already invoiced" state.
 *
 * One in-memory brand row and a fake Checkout that keeps its sessions, so a
 * second click sees what the first click stored, as in production.
 *
 * Session reuse lives in src/lib/setup-service.ts: setupServiceCheckoutUrl()
 * reads host.setupServiceOpenSessionId, checkStoredSetupSession() returns
 * the same open session's URL, and a compare-and-set on the brand row makes
 * two clicks at the same moment end on ONE session (the loser expires its
 * own). No Stripe idempotency key is used; the stored session id is the key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  sessions: new Map<string, Record<string, unknown>>(),
  n: 0,
  payments: [] as Record<string, unknown>[],
}));

function matches(row: Row, where: Row): boolean {
  for (const [key, cond] of Object.entries(where)) {
    const v = row[key];
    if (cond === null) {
      if (v !== null && v !== undefined) return false;
    } else if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { not?: unknown; notIn?: unknown[] };
      if ("not" in c && c.not === null && (v === null || v === undefined)) return false;
      if (c.notIn && c.notIn.includes(v)) return false;
    } else if (v !== cond) {
      return false;
    }
  }
  return true;
}

const db = vi.hoisted(() => ({
  prisma: {
    host: {
      findUnique: vi.fn(async () => ({ ...state.row, users: [] })),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        if (!matches(state.row, where)) return { count: 0 };
        Object.assign(state.row, data);
        return { count: 1 };
      }),
    },
    user: { findMany: vi.fn(async () => []) },
    setupServicePayment: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        if (state.payments.some((p) => p.sessionId === data.sessionId)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        state.payments.push({ ...data });
        return data;
      }),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}));

const fakeStripe = vi.hoisted(() => {
  const client = {
    checkout: {
      sessions: {
        create: vi.fn(async (args: { line_items: { price_data: { unit_amount: number } }[]; metadata: Record<string, string> }) => {
          state.n += 1;
          const id = `cs_live_a1B2c3D4test${state.n}`;
          const s = {
            id,
            url: `https://checkout.stripe.test/c/pay/${id}`,
            status: "open",
            payment_status: "unpaid",
            amount_total: args.line_items.reduce((t, l) => t + l.price_data.unit_amount, 0),
            metadata: args.metadata,
            customer: "cus_1",
            payment_intent: null,
          };
          state.sessions.set(id, s);
          return { ...s };
        }),
        retrieve: vi.fn(async (id: string) => {
          const s = state.sessions.get(id);
          if (!s) throw new Error("No such checkout.session");
          return { ...s };
        }),
        expire: vi.fn(async (id: string) => {
          const s = state.sessions.get(id);
          if (s && s.status === "open") s.status = "expired";
          return { ...s };
        }),
      },
    },
  };
  return { client };
});

const mail = vi.hoisted(() => ({
  dispatchPlatformEmail: vi.fn(async (a: Record<string, unknown>) => ({ ok: true, a })),
}));

vi.mock("@/lib/db", () => db);
vi.mock("@/lib/messaging", () => mail);
vi.mock("@/lib/stripe", () => ({ requireStripeClient: () => fakeStripe.client }));
vi.mock("@/lib/notification-prefs", () => ({ canSendEmailTo: vi.fn(async () => true) }));
vi.mock("@/lib/features", () => ({ canonicalSiteOrigin: () => "https://ycb.test" }));
vi.mock("@/lib/platform-billing", () => ({
  HostingBillingError: class extends Error {
    constructor(public code: string) {
      super(code);
    }
  },
  ensurePlatformCustomer: vi.fn(async () => "cus_1"),
  stripeObjectId: (v: unknown) => (typeof v === "string" ? v : null),
}));

import { recordSetupServicePayment, setupServiceCheckoutUrl } from "./setup-service";

const TOTAL = 51525; // $500 + $15.25 card processing

function resetBrand(over: Row = {}) {
  state.row = {
    id: "h1",
    name: "QA Marketplace Test",
    slug: "qa-marketplace-test",
    stripeCustomerId: "cus_1",
    contactEmail: "qa@example.com",
    billingEmail: null,
    setupServiceStatus: "NONE",
    setupServiceOpenSessionId: null,
    setupServiceCheckoutSessionId: null,
    setupServiceAdminNotifiedAt: null,
    ...over,
  };
}

/** What the route does on each click: read the brand row, then check out. */
async function click(): Promise<string> {
  const host = { ...state.row } as never;
  return setupServiceCheckoutUrl(host);
}

const openSessions = () =>
  [...state.sessions.values()].filter((s) => s.status === "open");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PLATFORM_ALERT_EMAIL", "alerts@example.com");
  state.sessions.clear();
  state.payments = [];
  state.n = 0;
  resetBrand();
});

describe("duplicate click on Buy full setup ($515.25) reuses one Checkout session", () => {
  it("second click (after the first stored its session) gets the SAME session id, no new session", async () => {
    const first = await click();
    const second = await click();
    expect(second).toBe(first);
    expect(fakeStripe.client.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(state.row.setupServiceOpenSessionId).toBe("cs_live_a1B2c3D4test1");
    expect(openSessions()).toHaveLength(1);
    expect(openSessions()[0].amount_total).toBe(TOTAL);
  });

  it("many clicks in a row: still one open $515.25 session", async () => {
    const urls = [];
    for (let i = 0; i < 5; i++) urls.push(await click());
    expect(new Set(urls).size).toBe(1);
    expect(fakeStripe.client.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(openSessions()).toHaveLength(1);
  });

  it("two clicks at the same moment (both read an empty row): both land on ONE open session", async () => {
    const [a, b] = await Promise.all([click(), click()]);
    expect(a).toBe(b);
    // Each click made a session, but the loser expired its own at once.
    expect(fakeStripe.client.checkout.sessions.create).toHaveBeenCalledTimes(2);
    expect(openSessions()).toHaveLength(1);
    expect(openSessions()[0].id).toBe(state.row.setupServiceOpenSessionId);
    expect(a).toContain(String(state.row.setupServiceOpenSessionId));
  });

  it("stored session expired in Checkout (after 24 h): a new session, then reused", async () => {
    const first = await click();
    state.sessions.get(String(state.row.setupServiceOpenSessionId))!.status = "expired";
    const second = await click();
    expect(second).not.toBe(first);
    expect(await click()).toBe(second);
    expect(fakeStripe.client.checkout.sessions.create).toHaveBeenCalledTimes(2);
    expect(openSessions()).toHaveLength(1);
  });

  it("first session was paid in another tab: the next click records it and opens no checkout", async () => {
    await click();
    const s = state.sessions.get(String(state.row.setupServiceOpenSessionId))!;
    Object.assign(s, { status: "complete", payment_status: "paid", payment_intent: "pi_1" });
    await expect(click()).rejects.toMatchObject({ code: "setup_paid" });
    expect(fakeStripe.client.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(state.row.setupServiceStatus).toBe("PAID");
    expect(state.row.setupServiceOpenSessionId).toBeNull();
    expect(state.payments).toHaveLength(1);
  });
});

describe("Full setup already invoiced (INVOICED)", () => {
  it("click while INVOICED: refused with setup_invoiced, no Checkout call at all", async () => {
    resetBrand({ setupServiceStatus: "INVOICED" });
    await expect(click()).rejects.toMatchObject({ code: "setup_invoiced" });
    expect(fakeStripe.client.checkout.sessions.retrieve).not.toHaveBeenCalled();
    expect(fakeStripe.client.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("INVOICED with an old open card session on file: still refused, the old session is not handed out", async () => {
    await click();
    state.row.setupServiceStatus = "INVOICED";
    await expect(click()).rejects.toMatchObject({ code: "setup_invoiced" });
    expect(fakeStripe.client.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(fakeStripe.client.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it("admin marks INVOICED while a click is in flight: our new session is expired, setup_invoiced", async () => {
    const host = { ...state.row } as never; // read before the admin change
    state.row.setupServiceStatus = "INVOICED";
    await expect(setupServiceCheckoutUrl(host)).rejects.toMatchObject({ code: "setup_invoiced" });
    expect(fakeStripe.client.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(openSessions()).toHaveLength(0);
    expect(state.row.setupServiceOpenSessionId).toBeNull();
  });

  it("card session paid after the brand was INVOICED: recorded as PAID once, admin told to void the invoice", async () => {
    await click();
    const s = state.sessions.get(String(state.row.setupServiceOpenSessionId))!;
    state.row.setupServiceStatus = "INVOICED";
    Object.assign(s, { status: "complete", payment_status: "paid", payment_intent: "pi_1" });
    expect(await recordSetupServicePayment(s as never)).toBe("recorded");
    expect(state.row.setupServiceStatus).toBe("PAID");
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(1);
    expect(String(mail.dispatchPlatformEmail.mock.calls[0][0].text)).toMatch(/Void that invoice/);
    // Webhook replay of the same session: nothing more.
    expect(await recordSetupServicePayment(s as never)).toBe("already");
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(1);
  });
});
