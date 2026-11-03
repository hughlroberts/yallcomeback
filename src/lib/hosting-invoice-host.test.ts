import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ prisma: { host: { findFirst: vi.fn() } } }));
vi.mock("@/lib/db", () => db);

import { failedInvoiceHostingHostId, hostingHostIdFromInvoiceMetadata } from "./hosting-invoice-host";

describe("failed invoice → hosting host (T45)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the Marketplace subscription metadata on the invoice parent", async () => {
    const inv = {
      parent: {
        subscription_details: {
          metadata: { kind: "hosting_subscription", product: "marketplace", hostId: "h1" },
          subscription: "sub_1",
        },
      },
    };
    expect(hostingHostIdFromInvoiceMetadata(inv)).toBe("h1");
    expect(await failedInvoiceHostingHostId(inv)).toBe("h1");
    expect(db.prisma.host.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to the host on that subscription when there is no metadata", async () => {
    db.prisma.host.findFirst.mockResolvedValue({ id: "h2" });
    expect(await failedInvoiceHostingHostId({ subscription: "sub_2" })).toBe("h2");
    expect(db.prisma.host.findFirst).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_2" },
      select: { id: true },
    });
  });

  it("never matches an add-on invoice", async () => {
    const inv = {
      parent: { subscription_details: { metadata: { kind: "pricing_addon", hostId: "h1" }, subscription: "sub_3" } },
    };
    expect(await failedInvoiceHostingHostId(inv)).toBeNull();
    expect(db.prisma.host.findFirst).not.toHaveBeenCalled();
  });
});
