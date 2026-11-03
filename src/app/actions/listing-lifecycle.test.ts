import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  hostId: string;
  title: string;
  slug: string;
  published: boolean;
  listOnMarketplace: boolean;
  archivedAt: Date | null;
  propertyType?: string;
  city?: string;
  region?: string;
};

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  activeStays: 0,
  payments: 0,
  access: null as null | {
    hostId: string | null;
    isPlatform: boolean;
    hostAccess?: "OWNER" | "FULL" | "LIMITED" | null;
    session: { user: { id: string } };
  },
}));

const db = vi.hoisted(() => {
  const property = {
    findFirst: vi.fn(async ({ where }: { where: { id: string; hostId: string } }) =>
      state.rows.find((r) => r.id === where.id && r.hostId === where.hostId) ?? null,
    ),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const r = state.rows.find((x) => x.id === where.id)!;
      Object.assign(r, data);
      return r;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      state.rows = state.rows.filter((r) => r.id !== where.id);
      return {};
    }),
  };
  const booking = {
    count: vi.fn<(args: unknown) => Promise<number>>(async () => state.activeStays),
  };
  const payment = { count: vi.fn(async () => state.payments) };
  const tx = { property, booking, payment };
  return {
    prisma: {
      property,
      booking,
      payment,
      host: { findUnique: vi.fn(async () => ({ slug: "brand-a" })) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});

vi.mock("@/lib/db", () => db);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireHostAdmin: vi.fn(async () => state.access) }));
vi.mock("@/lib/hosting", () => ({ assertHostAllowsFutureWork: vi.fn() }));
vi.mock("@/lib/email-verified", () => ({ assertEmailVerifiedForPublish: vi.fn() }));

import {
  archiveListing,
  deleteListing,
  pauseListing,
  restoreListing,
  resumeListing,
} from "./listing-lifecycle";
import { deleteConfirmMatches, listingLifecycleState } from "@/lib/listing-lifecycle";

function fd(id: string, extra: Record<string, string> = {}) {
  const f = new FormData();
  f.set("id", id);
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

function asHost(hostId: string, hostAccess: "OWNER" | "FULL" | "LIMITED" = "OWNER") {
  state.access = { hostId, isPlatform: false, hostAccess, session: { user: { id: "u1" } } };
}

const row = (id: string) => state.rows.find((r) => r.id === id);

beforeEach(() => {
  vi.clearAllMocks();
  state.activeStays = 0;
  state.payments = 0;
  state.rows = [
    { id: "pa", hostId: "brand-a", title: "Lakefront Cabin", slug: "lakefront", published: true, listOnMarketplace: true, archivedAt: null },
    { id: "pd", hostId: "brand-a", title: "Untitled listing", slug: "draft-1", published: false, listOnMarketplace: false, archivedAt: null, propertyType: "cabin", city: "Austin", region: "TX" },
    { id: "pb", hostId: "brand-b", title: "Other Brand Stay", slug: "other", published: true, listOnMarketplace: true, archivedAt: null },
  ];
  asHost("brand-a");
});

describe("pause / resume", () => {
  it("pause hides the listing and keeps the marketplace choice and data", async () => {
    expect(await pauseListing(fd("pa"))).toEqual({ ok: true });
    expect(row("pa")).toMatchObject({ published: false, listOnMarketplace: true, archivedAt: null });
  });

  it("resume turns bookings back on", async () => {
    row("pa")!.published = false;
    expect(await resumeListing(fd("pa"))).toEqual({ ok: true });
    expect(row("pa")!.published).toBe(true);
  });

  it("resume is blocked while archived", async () => {
    Object.assign(row("pa")!, { published: false, archivedAt: new Date() });
    const r = await resumeListing(fd("pa"));
    expect(r.ok).toBe(false);
    expect(row("pa")!.published).toBe(false);
  });

  it("limited co-hosts can pause (same as Taking bookings)", async () => {
    asHost("brand-a", "LIMITED");
    expect(await pauseListing(fd("pa"))).toEqual({ ok: true });
  });
});

describe("archive / restore", () => {
  it("archive sets archivedAt and unpublishes", async () => {
    expect(await archiveListing(fd("pa"))).toEqual({ ok: true });
    expect(row("pa")!.archivedAt).toBeInstanceOf(Date);
    expect(row("pa")!.published).toBe(false);
    expect(listingLifecycleState(row("pa")!)).toBe("archived");
  });

  it("restore brings it back as paused", async () => {
    await archiveListing(fd("pa"));
    expect(await restoreListing(fd("pa"))).toEqual({ ok: true });
    expect(row("pa")).toMatchObject({ archivedAt: null, published: false });
    expect(listingLifecycleState(row("pa")!)).toBe("paused");
  });

  it("limited co-hosts cannot archive or restore", async () => {
    asHost("brand-a", "LIMITED");
    expect((await archiveListing(fd("pa"))).ok).toBe(false);
    expect((await restoreListing(fd("pa"))).ok).toBe(false);
    expect(db.prisma.property.update).not.toHaveBeenCalled();
  });
});

describe("delete", () => {
  it("needs the typed listing name", async () => {
    const r = await deleteListing(fd("pa", { confirmTitle: "wrong" }));
    expect(r.ok).toBe(false);
    expect(db.prisma.property.delete).not.toHaveBeenCalled();
  });

  it("an untitled draft can be confirmed with its shown Draft label (T32)", async () => {
    expect(await deleteListing(fd("pd", { confirmTitle: "Draft · Cabin · Austin, TX" }))).toEqual({ ok: true });
    expect(row("pd")).toBeUndefined();
  });

  it("deletes when confirmed and no stays or payments", async () => {
    expect(await deleteListing(fd("pa", { confirmTitle: " lakefront cabin " }))).toEqual({ ok: true });
    expect(row("pa")).toBeUndefined();
  });

  it("is blocked by upcoming or active confirmed stays and suggests Archive", async () => {
    state.activeStays = 2;
    const r = await deleteListing(fd("pa", { confirmTitle: "Lakefront Cabin" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Archive it instead/);
    expect(db.prisma.property.delete).not.toHaveBeenCalled();
    const where = db.prisma.booking.count.mock.calls[0]![0] as unknown as {
      where: { status: { in: string[] }; checkOut: { gte: Date } };
    };
    expect(where.where.status.in).toContain("CONFIRMED");
    expect(where.where.checkOut.gte).toBeInstanceOf(Date);
  });

  it("is blocked when payment records exist (keeps money history)", async () => {
    state.payments = 1;
    const r = await deleteListing(fd("pa", { confirmTitle: "Lakefront Cabin" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Archive it instead/);
    expect(row("pa")).toBeDefined();
  });

  it("limited co-hosts cannot delete", async () => {
    asHost("brand-a", "LIMITED");
    const r = await deleteListing(fd("pa", { confirmTitle: "Lakefront Cabin" }));
    expect(r.ok).toBe(false);
    expect(db.prisma.property.delete).not.toHaveBeenCalled();
  });
});

describe("cross-brand denial", () => {
  const actions = {
    pause: () => pauseListing(fd("pb")),
    resume: () => resumeListing(fd("pb")),
    archive: () => archiveListing(fd("pb")),
    restore: () => restoreListing(fd("pb")),
    delete: () => deleteListing(fd("pb", { confirmTitle: "Other Brand Stay" })),
  };

  for (const [name, run] of Object.entries(actions)) {
    it(`${name}: a brand A owner cannot touch a brand B listing`, async () => {
      const before = { ...row("pb")! };
      const r = await run();
      expect(r).toEqual({ ok: false, error: "You cannot change this listing." });
      expect(db.prisma.property.update).not.toHaveBeenCalled();
      expect(db.prisma.property.delete).not.toHaveBeenCalled();
      expect(row("pb")).toEqual(before);
    });

    it(`${name}: Platform admin with no brand picked is denied`, async () => {
      state.access = { hostId: null, isPlatform: true, session: { user: { id: "admin" } } };
      const r = await run();
      expect(r.ok).toBe(false);
      expect(db.prisma.property.update).not.toHaveBeenCalled();
      expect(db.prisma.property.delete).not.toHaveBeenCalled();
    });

    it(`${name}: signed-out callers are denied`, async () => {
      state.access = null;
      expect((await run()).ok).toBe(false);
    });
  }

  it("Platform admin with brand B picked can archive brand B", async () => {
    state.access = { hostId: "brand-b", isPlatform: true, session: { user: { id: "admin" } } };
    expect(await archiveListing(fd("pb"))).toEqual({ ok: true });
  });
});

describe("deleteConfirmMatches", () => {
  it("matches name ignoring case and extra spaces only", () => {
    expect(deleteConfirmMatches("Lakefront  Cabin", "lakefront cabin")).toBe(true);
    expect(deleteConfirmMatches("Lakefront Cabin", "Lakefront")).toBe(false);
    expect(deleteConfirmMatches("", "")).toBe(false);
  });
});
