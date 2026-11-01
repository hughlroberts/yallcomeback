import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    property: { findUnique: vi.fn() },
    calendarBlock: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    seasonalPrice: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
const invoice = vi.hoisted(() => ({ sendStripeInvoiceForBlock: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/db", () => db);
vi.mock("next/cache", () => cache);
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/scope", () => ({
  ensureHostAccess: vi.fn(async () => ({ hostId: "h1", isPlatform: false })),
  assertPropertyAccess: vi.fn(async () => ({ id: "p1" })),
  resolveHostIdForCreate: vi.fn(),
}));
vi.mock("@/lib/hosting", () => ({ assertHostAllowsFutureWork: vi.fn() }));
vi.mock("@/lib/email-verified", () => ({
  assertEmailVerifiedForPublish: vi.fn(),
}));
vi.mock("@/lib/upload-image", () => ({
  PROPERTY_IMAGE_MAX_BYTES: 1,
  readUploadedImage: vi.fn(),
  writePublicUpload: vi.fn(),
}));
vi.mock("@/lib/safe-url", () => ({ assertSafeOutboundUrl: vi.fn() }));
vi.mock("@/lib/block-invoice", () => invoice);

import { addCalendarBlock, setNightlyPriceForRange } from "./properties";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const base = {
  propertyId: "p1",
  startDate: "2026-11-06",
  endDate: "2026-11-08",
  blockType: "OFFLINE",
  occupantName: "Jane Smith",
  paymentMethod: "MANUAL",
  invoiceAmount: "400",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.property.findUnique.mockResolvedValue({ hostId: "h1" });
  db.prisma.calendarBlock.findUnique.mockResolvedValue(null);
  db.prisma.calendarBlock.findFirst.mockResolvedValue(null);
  db.prisma.calendarBlock.create.mockResolvedValue({ id: "b1" });
});

describe("addCalendarBlock double-submit protection", () => {
  it("saves once and stores the client request key", async () => {
    const res = await addCalendarBlock(
      form({ ...base, clientRequestId: "req-12345678" }),
    );
    expect(res).toEqual({ ok: true });
    expect(db.prisma.calendarBlock.create).toHaveBeenCalledTimes(1);
    const data = db.prisma.calendarBlock.create.mock.calls[0]![0].data;
    expect(data.clientRequestId).toBe("req-12345678");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/admin/bookings");
  });

  it("treats a repeat of the same key as already saved", async () => {
    db.prisma.calendarBlock.findUnique.mockResolvedValue({ id: "b1" });
    const res = await addCalendarBlock(
      form({ ...base, clientRequestId: "req-12345678" }),
    );
    expect(res).toEqual({ ok: true, duplicate: true });
    expect(db.prisma.calendarBlock.create).not.toHaveBeenCalled();
  });

  it("dedupes an identical block saved moments ago (no key)", async () => {
    db.prisma.calendarBlock.findFirst.mockResolvedValue({ id: "b0" });
    const res = await addCalendarBlock(form(base));
    expect(res).toEqual({ ok: true, duplicate: true });
    expect(db.prisma.calendarBlock.create).not.toHaveBeenCalled();
    const where = db.prisma.calendarBlock.findFirst.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      propertyId: "p1",
      source: "MANUAL",
      blockType: "OFFLINE",
      occupantName: "Jane Smith",
    });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("returns ok when two taps race on the unique key", async () => {
    db.prisma.calendarBlock.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint"), { code: "P2002" }),
    );
    const res = await addCalendarBlock(
      form({ ...base, clientRequestId: "req-12345678" }),
    );
    expect(res).toEqual({ ok: true, duplicate: true });
  });

  it("ignores a malformed key", async () => {
    await addCalendarBlock(form({ ...base, clientRequestId: "x" }));
    const data = db.prisma.calendarBlock.create.mock.calls[0]![0].data;
    expect(data.clientRequestId).toBeNull();
  });
});

describe("addCalendarBlock amount and paid", () => {
  it("marks the stay paid and skips the invoice email", async () => {
    await addCalendarBlock(
      form({
        ...base,
        guestEmail: "jane@example.com",
        markPaid: "on",
        sendInvoice: "on",
      }),
    );
    const data = db.prisma.calendarBlock.create.mock.calls[0]![0].data;
    expect(data.invoiceAmount).toBe(400);
    expect(data.invoiceStatus).toBe("PAID");
    expect(data.invoicePaidAt).toBeInstanceOf(Date);
    expect(invoice.sendStripeInvoiceForBlock).not.toHaveBeenCalled();
  });

  it("leaves paid status alone when not checked", async () => {
    await addCalendarBlock(form(base));
    const data = db.prisma.calendarBlock.create.mock.calls[0]![0].data;
    expect(data.invoiceStatus).toBeUndefined();
    expect(data.invoicePaidAt).toBeUndefined();
  });
});

describe("setNightlyPriceForRange", () => {
  it("creates a custom price whose last night is the day before checkout", async () => {
    db.prisma.seasonalPrice.findFirst.mockResolvedValue(null);
    const res = await setNightlyPriceForRange(
      form({
        propertyId: "p1",
        startDate: "2026-11-06",
        endDate: "2026-11-07",
        nightlyRate: "189",
      }),
    );
    expect(res).toEqual({ ok: true });
    const data = db.prisma.seasonalPrice.create.mock.calls[0]![0].data;
    expect(data.nightlyRate).toBe(189);
    expect(data.minNights).toBe(1);
    expect(data.startDate.getDate()).toBe(6);
    expect(data.endDate.getDate()).toBe(6); // one night: Nov 6 only
  });

  it("updates the same nights instead of stacking rows", async () => {
    db.prisma.seasonalPrice.findFirst.mockResolvedValue({ id: "s1" });
    await setNightlyPriceForRange(
      form({
        propertyId: "p1",
        startDate: "2026-11-06",
        endDate: "2026-11-09",
        nightlyRate: "210.5",
      }),
    );
    expect(db.prisma.seasonalPrice.create).not.toHaveBeenCalled();
    expect(db.prisma.seasonalPrice.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { nightlyRate: 210.5 },
    });
  });

  it("rejects a missing or zero price", async () => {
    const res = await setNightlyPriceForRange(
      form({
        propertyId: "p1",
        startDate: "2026-11-06",
        endDate: "2026-11-07",
        nightlyRate: "0",
      }),
    );
    expect(res.ok).toBe(false);
    expect(db.prisma.seasonalPrice.create).not.toHaveBeenCalled();
  });
});
