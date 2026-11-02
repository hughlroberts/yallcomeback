/**
 * Brand isolation for a platform admin who co-hosts two brands.
 * Hugh's account has a home brand (Hugh Roberts) and also manages Cherokee
 * Landing. With a brand picked, /admin shows only that brand. With no brand
 * picked, it shows no brand data at all.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const HUGH = "host_hugh_roberts";
const CHEROKEE = "host_cherokee_landing";

const state = vi.hoisted(() => ({ cookieBrand: null as string | null }));
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  property: { count: vi.fn<(...a: unknown[]) => Promise<number>>(async () => 0), findMany: vi.fn<(...a: unknown[]) => Promise<unknown[]>>(async () => []) },
  booking: { count: vi.fn<(...a: unknown[]) => Promise<number>>(async () => 0), findMany: vi.fn<(...a: unknown[]) => Promise<unknown[]>>(async () => []) },
  calendarBlock: { findMany: vi.fn<(...a: unknown[]) => Promise<unknown[]>>(async () => []) },
  host: { findUnique: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => null) },
}));
const authMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, auth: authMock, signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: () => ({}) }));
vi.mock("@/auth.config", () => ({ authConfig: {} }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/admin-brand-context", () => ({
  getAdminBrandHostId: vi.fn(async () => state.cookieBrand),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
  notFound: vi.fn(),
}));

import { requireHostAdmin } from "@/lib/auth";
import {
  bookingScopeWhere,
  calendarBlockScopeWhere,
  NO_BRAND_HOST_ID,
  propertyScopeWhere,
} from "@/lib/scope";
import {
  conversationAccessWhere,
  getMessagesViewer,
} from "@/lib/messages-access";
import { shouldShowPickBrandOnly } from "@/lib/admin-brand-path";
import AdminDashboard from "@/app/admin/page";

/** Hugh: platform admin whose own account row points at his home brand. */
function signInAsCoHost() {
  authMock.mockResolvedValue({
    user: { id: "u_hugh", email: "hugh@example.com", role: "ADMIN", hostId: HUGH },
  });
  db.user.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
    args?.select && "emailVerifiedAt" in args.select
      ? { emailVerifiedAt: new Date() }
      : { role: "ADMIN", hostId: HUGH, hostAccess: null },
  );
}

function hostIdsIn(where: unknown): string[] {
  const out: string[] = [];
  JSON.stringify(where, (k, v) => {
    if (k === "hostId" && typeof v === "string") out.push(v);
    return v;
  });
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.cookieBrand = null;
  signInAsCoHost();
});

describe("scope helpers", () => {
  it("scope to the picked brand only", () => {
    const a = { hostId: CHEROKEE };
    expect(propertyScopeWhere(a)).toEqual({ hostId: CHEROKEE });
    expect(bookingScopeWhere(a)).toEqual({ property: { hostId: CHEROKEE } });
    expect(calendarBlockScopeWhere(a)).toEqual({ property: { hostId: CHEROKEE } });
  });

  it("never return an unscoped filter when no brand is picked", () => {
    for (const fn of [propertyScopeWhere, bookingScopeWhere, calendarBlockScopeWhere]) {
      expect(hostIdsIn(fn({ hostId: null }))).toEqual([NO_BRAND_HOST_ID]);
    }
  });

  it("pick-brand view shows only the chooser for a platform admin", () => {
    expect(shouldShowPickBrandOnly({ isPlatform: true, activeBrandId: null })).toBe(true);
    expect(shouldShowPickBrandOnly({ isPlatform: true, activeBrandId: HUGH })).toBe(false);
    expect(shouldShowPickBrandOnly({ isPlatform: false, activeBrandId: null })).toBe(false);
  });
});

describe("requireHostAdmin for a co-host of two brands", () => {
  it("uses the picked brand, not the account's home brand", async () => {
    state.cookieBrand = CHEROKEE;
    const access = await requireHostAdmin();
    expect(access?.hostId).toBe(CHEROKEE);
    state.cookieBrand = HUGH;
    expect((await requireHostAdmin())?.hostId).toBe(HUGH);
  });

  it("has no brand when none is picked (home brand does not leak in)", async () => {
    const access = await requireHostAdmin();
    expect(access?.isPlatform).toBe(true);
    expect(access?.hostId).toBeNull();
  });
});

describe("admin dashboard queries", () => {
  it("Hugh Roberts brand: every query is Hugh Roberts only (no Cherokee stays)", async () => {
    state.cookieBrand = HUGH;
    await AdminDashboard({ searchParams: Promise.resolve({}) });
    const wheres = [
      db.property.count.mock.calls[0]![0],
      db.booking.count.mock.calls[0]![0],
      db.calendarBlock.findMany.mock.calls[0]![0],
      db.booking.findMany.mock.calls[0]![0],
    ].map((c) => (c as { where: unknown }).where);
    for (const w of wheres) {
      expect(hostIdsIn(w)).toEqual([HUGH]);
    }
  });

  it("Cherokee brand: upcoming stays are Cherokee only", async () => {
    state.cookieBrand = CHEROKEE;
    await AdminDashboard({ searchParams: Promise.resolve({}) });
    const w = (db.calendarBlock.findMany.mock.calls[0]![0] as { where: unknown }).where;
    expect(hostIdsIn(w)).toEqual([CHEROKEE]);
  });

  it("no brand picked: queries match no brand", async () => {
    await AdminDashboard({ searchParams: Promise.resolve({}) });
    const w = (db.calendarBlock.findMany.mock.calls[0]![0] as { where: unknown }).where;
    expect(hostIdsIn(w)).toEqual([NO_BRAND_HOST_ID]);
    expect(db.host.findUnique).not.toHaveBeenCalled();
  });
});

describe("messages inbox for a co-host of two brands", () => {
  it("shows only the picked brand's conversations", async () => {
    state.cookieBrand = CHEROKEE;
    const viewer = await getMessagesViewer();
    expect(viewer?.hostId).toBe(CHEROKEE);
    expect(hostIdsIn(conversationAccessWhere(viewer!))).toEqual([CHEROKEE]);
  });

  it("no brand picked: no brand's conversations (not the home brand)", async () => {
    const viewer = await getMessagesViewer();
    expect(viewer?.hostId).toBeNull();
    expect(hostIdsIn(conversationAccessWhere(viewer!))).toEqual([]);
  });
});
