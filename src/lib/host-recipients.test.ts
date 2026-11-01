import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  host: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
}));
const prefs = vi.hoisted(() => ({
  canSendEmailTo: vi.fn<(email: string) => Promise<boolean>>(async () => true),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/notification-prefs", () => prefs);

import {
  dedupeEmails,
  hostEmailRecipients,
  maskEmail,
} from "./host-recipients";

beforeEach(() => {
  vi.clearAllMocks();
  prefs.canSendEmailTo.mockImplementation(async () => true);
});

describe("hostEmailRecipients", () => {
  it("emails a brand-scoped admin account and the billing email (not just role HOST)", async () => {
    // The bug on eafd155: an owner whose account is ADMIN (or who is only
    // on the brand as its billing email) never got host emails.
    db.host.findUnique.mockResolvedValue({
      contactEmail: "brand@icloud.com",
      billingEmail: "owner@me.com",
    });
    db.user.findMany.mockResolvedValue([
      { email: "admin-owner@me.com" },
      { email: "cohost@example.com" },
    ]);
    expect(await hostEmailRecipients("h1")).toEqual([
      "brand@icloud.com",
      "owner@me.com",
      "admin-owner@me.com",
      "cohost@example.com",
    ]);
    const where = db.user.findMany.mock.calls[0]![0].where;
    expect(where.role).toEqual({ in: ["HOST", "ADMIN"] });
    expect(where.hostId).toBe("h1");
    expect(where.emailNotifications).toBe(true);
  });

  it("still emails co-hosts when the brand has no contact email", async () => {
    db.host.findUnique.mockResolvedValue({
      contactEmail: null,
      billingEmail: null,
    });
    db.user.findMany.mockResolvedValue([{ email: "Cohost@Example.com" }]);
    expect(await hostEmailRecipients("h1")).toEqual(["cohost@example.com"]);
  });

  it("drops opted-out addresses and warns when nobody is left", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.host.findUnique.mockResolvedValue({
      contactEmail: "a@x.com",
      billingEmail: "a@x.com",
    });
    db.user.findMany.mockResolvedValue([]);
    prefs.canSendEmailTo.mockImplementation(async () => false);
    expect(await hostEmailRecipients("h1")).toEqual([]);
    expect(warn).toHaveBeenCalledWith("[host-email] no host recipients", {
      hostId: "h1",
    });
    warn.mockRestore();
  });
});

describe("helpers", () => {
  it("dedupes case-insensitively and drops blanks", () => {
    expect(
      dedupeEmails(["A@x.com", "a@x.com ", null, "", "nope", "b@x.com"]),
    ).toEqual(["a@x.com", "b@x.com"]);
  });

  it("masks addresses for logs", () => {
    expect(maskEmail("hughroberts@me.com")).toBe("hu***@me.com");
    expect(maskEmail("bad")).toBe("***");
  });
});
