import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    conversation: { findUnique: vi.fn(), update: vi.fn() },
    message: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  incomingIp: vi.fn(async () => "203.0.113.9"),
  rateLimitHit: vi.fn(() => ({ allowed: true })),
}));
const delivery = vi.hoisted(() => ({ deliverGuestMessageToHosts: vi.fn() }));
vi.mock("@/lib/conversation-delivery", () => delivery);

const savedSecret = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "test-auth-secret-not-real";
afterAll(() => {
  if (savedSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = savedSecret;
});

import { isGuestThreadPath, platformGate } from "@/auth.config";
import { createGuestThreadToken } from "@/lib/guest-thread-access";
import { replyWithGuestThreadLink } from "@/app/actions/guest-thread";

const CONV = "cmvze9l7n0001pa01ctdbrnmu";
const EMAIL = "guest@example.test";

function gate(path: string, isLoggedIn = false) {
  return platformGate({
    isLoggedIn,
    nextUrl: new URL(`https://www.yallcomeback.app${path}`),
  });
}

describe("guest thread matcher (T21)", () => {
  it.each([
    `/messages/${CONV}/guest`,
    "/messages/abc_DEF-123/guest",
  ])("matches %s", (p) => expect(isGuestThreadPath(p)).toBe(true));

  it.each([
    "/messages",
    "/messages/",
    `/messages/${CONV}`,
    `/messages/${CONV}/`,
    `/messages/${CONV}/guest/`,
    `/messages/${CONV}/guest/x`,
    `/messages/${CONV}/guests`,
    `/messages/${CONV}/guestx`,
    "/messages//guest",
    "/messages/a/b/guest",
    "/messages/../admin/guest",
    "/messages/a%2Fb/guest",
    "/messages/a.b/guest",
    `/messages/${"a".repeat(65)}/guest`,
    `/x/messages/${CONV}/guest`,
    `/admin/messages/${CONV}/guest`,
    `/messages/${CONV}/GUEST`,
  ])("does not match %s", (p) => expect(isGuestThreadPath(p)).toBe(false));
});

describe("platformGate and /messages (T21)", () => {
  it("lets a signed-out visitor reach the guest link page", () => {
    expect(gate(`/messages/${CONV}/guest?t=anything`)).toBe(true);
  });

  it.each([
    "/messages",
    `/messages/${CONV}`,
    `/messages/${CONV}/guest/x`,
    `/messages/${CONV}/guests`,
  ])("still sends signed-out visitors on %s to login", (p) => {
    const g = gate(p);
    expect(g).toBeInstanceOf(Response);
    expect((g as Response).headers.get("location")).toContain("/login");
  });

  it("keeps /admin/messages behind login", () => {
    expect(gate(`/admin/messages/${CONV}/guest`)).toBeInstanceOf(Response);
  });

  it("signed-in users still reach /messages", () => {
    expect(gate(`/messages/${CONV}`, true)).toBe(true);
  });
});

describe("reply from the guest link (T21)", () => {
  const thread = {
    id: CONV,
    hostId: "host1",
    guestEmail: EMAIL,
    guestUserId: null,
    opsAlert: false,
    status: "OPEN",
  };
  function form(t: string, body = "Hello host") {
    const f = new FormData();
    f.set("conversationId", CONV);
    f.set("t", t);
    f.set("body", body);
    return f;
  }
  async function run(f: FormData) {
    try {
      await replyWithGuestThreadLink(f);
      return "no redirect";
    } catch (e) {
      return String((e as Error).message);
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    db.prisma.conversation.findUnique.mockResolvedValue(thread);
  });

  it("a valid token posts the reply as the guest", async () => {
    const t = createGuestThreadToken(CONV, EMAIL)!;
    const r = await run(form(t));
    expect(r).toContain("sent=1");
    expect(db.prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: CONV,
        senderRole: "GUEST",
        senderUserId: null,
        body: "Hello host",
      }),
    });
    expect(delivery.deliverGuestMessageToHosts).toHaveBeenCalledWith("host1");
  });

  it("an expired token posts nothing", async () => {
    const t = createGuestThreadToken(CONV, EMAIL, Date.now() - 31 * 86400_000)!;
    const r = await run(form(t));
    expect(r).not.toContain("sent=1");
    expect(db.prisma.message.create).not.toHaveBeenCalled();
  });

  it("a tampered token posts nothing and never reads the thread", async () => {
    const t = createGuestThreadToken(CONV, EMAIL)!;
    const r = await run(form(`${t.slice(0, -2)}xx`));
    expect(r).not.toContain("sent=1");
    expect(db.prisma.conversation.findUnique).not.toHaveBeenCalled();
    expect(db.prisma.message.create).not.toHaveBeenCalled();
  });

  it("a token for another thread posts nothing", async () => {
    const t = createGuestThreadToken("othertoken123", EMAIL)!;
    expect(await run(form(t))).not.toContain("sent=1");
    expect(db.prisma.message.create).not.toHaveBeenCalled();
  });

  it("a token for another email posts nothing", async () => {
    const t = createGuestThreadToken(CONV, "someone@else.test")!;
    expect(await run(form(t))).not.toContain("sent=1");
    expect(db.prisma.message.create).not.toHaveBeenCalled();
  });
});
