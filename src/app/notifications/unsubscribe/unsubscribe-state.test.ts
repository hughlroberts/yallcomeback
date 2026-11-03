import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    messageDeliveryOptOut: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => db);
const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => nav);

process.env.AUTH_SECRET = "test-auth-secret-not-real";

import {
  applyChannelResubscribe,
  createUnsubscribeToken,
  isChannelOptedOut,
} from "@/lib/notification-prefs";
import { confirmResubscribe, confirmUnsubscribe } from "./actions";

function form(token: string) {
  const f = new FormData();
  f.set("token", token);
  return f;
}

async function run(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return String((e as Error).message);
  }
  return "";
}

describe("unsubscribe page: current state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("subscribed when no opt-out row and account emails are on", async () => {
    db.prisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    db.prisma.messageDeliveryOptOut.findUnique.mockResolvedValue(null);
    expect(
      await isChannelOptedOut({ channel: "email", address: "A@x.com" }),
    ).toBe(false);
    expect(db.prisma.messageDeliveryOptOut.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "a@x.com" } }),
    );
  });

  it("subscribed for a guest with no account and no opt-out", async () => {
    db.prisma.user.findUnique.mockResolvedValue(null);
    db.prisma.messageDeliveryOptOut.findUnique.mockResolvedValue(null);
    expect(
      await isChannelOptedOut({ channel: "email", address: "g@x.com" }),
    ).toBe(false);
  });

  it("already unsubscribed by link opt-out", async () => {
    db.prisma.user.findUnique.mockResolvedValue(null);
    db.prisma.messageDeliveryOptOut.findUnique.mockResolvedValue({
      emailOptOut: true,
    });
    expect(
      await isChannelOptedOut({ channel: "email", address: "g@x.com" }),
    ).toBe(true);
  });

  it("already unsubscribed by the account setting", async () => {
    db.prisma.user.findUnique.mockResolvedValue({ emailNotifications: false });
    db.prisma.messageDeliveryOptOut.findUnique.mockResolvedValue(null);
    expect(
      await isChannelOptedOut({ channel: "email", address: "a@x.com" }),
    ).toBe(true);
  });
});

describe("resubscribe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("re-enables message emails for that one address only", async () => {
    await applyChannelResubscribe({ channel: "email", address: " A@X.com " });
    expect(db.prisma.messageDeliveryOptOut.updateMany).toHaveBeenCalledWith({
      where: { email: "a@x.com" },
      data: { emailOptOut: false, source: "email_link_resubscribe" },
    });
    expect(db.prisma.user.updateMany).toHaveBeenCalledWith({
      where: { email: "a@x.com" },
      data: { emailNotifications: true },
    });
    expect(db.prisma.messageDeliveryOptOut.upsert).not.toHaveBeenCalled();
  });

  it("the Resubscribe POST uses the token's address and redirects back", async () => {
    const token = createUnsubscribeToken("guest@example.com", "email");
    const msg = await run(confirmResubscribe(form(token)));
    expect(msg).toContain("done=resubscribed");
    expect(db.prisma.user.updateMany).toHaveBeenCalledTimes(1);
    expect(db.prisma.user.updateMany.mock.calls[0]![0].where).toEqual({
      email: "guest@example.com",
    });
    expect(db.prisma.messageDeliveryOptOut.updateMany.mock.calls[0]![0].where).toEqual({
      email: "guest@example.com",
    });
  });

  it("a tampered token changes nothing", async () => {
    const token = createUnsubscribeToken("guest@example.com", "email");
    const bad = token.slice(0, -2) + (token.endsWith("A") ? "BB" : "AA");
    await run(confirmResubscribe(form(bad)));
    await run(confirmUnsubscribe(form(bad)));
    await run(confirmResubscribe(form("")));
    expect(db.prisma.user.updateMany).not.toHaveBeenCalled();
    expect(db.prisma.messageDeliveryOptOut.updateMany).not.toHaveBeenCalled();
    expect(db.prisma.messageDeliveryOptOut.upsert).not.toHaveBeenCalled();
  });

  it("the Unsubscribe POST still opts out that address", async () => {
    const token = createUnsubscribeToken("guest@example.com", "email");
    const msg = await run(confirmUnsubscribe(form(token)));
    expect(msg).toContain("done=unsubscribed");
    expect(db.prisma.messageDeliveryOptOut.upsert.mock.calls[0]![0].where).toEqual({
      email: "guest@example.com",
    });
  });
});
