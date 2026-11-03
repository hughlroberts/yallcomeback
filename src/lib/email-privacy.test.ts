import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// T18: no person's address in any header except the recipient's own To.
vi.mock("@/lib/notification-prefs", () => ({
  canSendEmailTo: vi.fn(async () => true),
  canSendSmsTo: vi.fn(async () => false),
  unsubscribeUrl: () => "https://example.test/unsub",
  oneClickUnsubscribeUrl: () => "https://example.test/one-click",
}));
vi.mock("@/lib/db", () => ({
  prisma: { message: { update: vi.fn(), updateMany: vi.fn() } },
}));

import { deliverHostMessageToGuest } from "@/lib/conversation-delivery";
import { replyAddressFor } from "@/lib/inbound/reply-address";
import {
  dispatchEmail,
  dispatchPlatformEmail,
  hostReplyToForGuest,
  safeReplyTo,
} from "@/lib/messaging";

const HOST_PERSONAL = "host.personal@icloud.example";
const GUEST = "guest@example.test";
const CONV = "cmvze9l7n0001pa01ctdbrnmu";

const KEYS = [
  "MESSAGING_EMAIL_ENABLED",
  "MESSAGING_EMAIL_FROM",
  "MESSAGING_EMAIL_API_KEY",
  "RESEND_API_KEY",
  "MESSAGING_EMAIL_DRY_RUN",
  "INBOUND_EMAIL_DOMAIN",
  "INBOUND_EMAIL_TOKEN_SECRET",
  "RESEND_INBOUND_WEBHOOK_SECRET",
];
const saved: Record<string, string | undefined> = {};
let payloads: Record<string, unknown>[] = [];

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  for (const k of KEYS) delete process.env[k];
  process.env.MESSAGING_EMAIL_ENABLED = "true";
  process.env.MESSAGING_EMAIL_FROM = "Yall Come Back <bookings@example.test>";
  process.env.RESEND_API_KEY = "test-not-a-real-key";
  payloads = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      payloads.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function enableReplyByEmail() {
  process.env.INBOUND_EMAIL_DOMAIN = "reply.example.test";
  process.env.INBOUND_EMAIL_TOKEN_SECRET = "test-secret-0123456789abcdef";
  process.env.RESEND_INBOUND_WEBHOOK_SECRET = "whsec_test";
}

/** Every address in the headers of one sent email. */
function headerAddresses(p: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const k of ["to", "cc", "bcc", "reply_to"]) {
    const v = p[k];
    if (Array.isArray(v)) out.push(...v.map(String));
    else if (typeof v === "string") out.push(v);
  }
  return out.map((a) => a.toLowerCase());
}

describe("safeReplyTo", () => {
  it("drops a person's address", () => {
    expect(safeReplyTo(HOST_PERSONAL, GUEST)).toBeNull();
    expect(safeReplyTo(GUEST, "host@example.test")).toBeNull();
  });

  it("keeps our signed thread address when reply-by-email is on", () => {
    enableReplyByEmail();
    const addr = replyAddressFor("c", CONV, "GUEST")!;
    expect(addr).toBeTruthy();
    expect(safeReplyTo(addr, GUEST)).toBe(addr);
  });

  it("drops a forged thread address", () => {
    enableReplyByEmail();
    expect(
      safeReplyTo(
        "reply+c-g-cmvze9l7n0001pa01ctdbrnmu-0000@reply.example.test",
        GUEST,
      ),
    ).toBeNull();
  });
});

describe("guest copy of a host reply", () => {
  const thread = {
    id: CONV,
    guestEmail: GUEST,
    guestPhone: null,
    guestUserId: null,
    host: { name: "Hugh Roberts", contactEmail: HOST_PERSONAL },
  };

  it("shows only the guest, with no Reply-To, when reply-by-email is off", async () => {
    await deliverHostMessageToGuest(thread, "m1", "Hello");
    expect(payloads).toHaveLength(1);
    const p = payloads[0];
    expect(p.to).toEqual([GUEST]);
    expect(p.reply_to).toBeUndefined();
    expect(headerAddresses(p)).toEqual([GUEST]);
    expect(String(p.from)).toContain("<bookings@example.test>");
    expect(JSON.stringify(p)).not.toContain(HOST_PERSONAL);
  });

  it("uses only the thread address when reply-by-email is on", async () => {
    enableReplyByEmail();
    await deliverHostMessageToGuest(thread, "m1", "Hello");
    const p = payloads[0];
    expect(p.to).toEqual([GUEST]);
    expect(p.reply_to).toEqual([replyAddressFor("c", CONV, "GUEST")]);
    expect(JSON.stringify(p)).not.toContain(HOST_PERSONAL);
  });

  it("keeps the host email hidden when the brand setting is off", async () => {
    await deliverHostMessageToGuest(
      { ...thread, host: { ...thread.host, showEmailToGuests: false } },
      "m1",
      "Hello",
    );
    expect(payloads[0].reply_to).toBeUndefined();
    expect(JSON.stringify(payloads[0])).not.toContain(HOST_PERSONAL);
  });

  it("uses the brand email as Reply-To when the brand opted in", async () => {
    await deliverHostMessageToGuest(
      { ...thread, host: { ...thread.host, showEmailToGuests: true } },
      "m1",
      "Hello",
    );
    const p = payloads[0];
    expect(p.to).toEqual([GUEST]);
    expect(p.reply_to).toEqual([HOST_PERSONAL]);
    expect(p.cc).toBeUndefined();
    expect(p.bcc).toBeUndefined();
  });

  it("opt-in wins over the thread address", async () => {
    enableReplyByEmail();
    await deliverHostMessageToGuest(
      { ...thread, host: { ...thread.host, showEmailToGuests: true } },
      "m1",
      "Hello",
    );
    expect(payloads[0].reply_to).toEqual([HOST_PERSONAL]);
  });
});

describe("hostReplyToForGuest", () => {
  it("is null unless the brand opted in with a usable email", () => {
    expect(hostReplyToForGuest(null)).toBeNull();
    expect(hostReplyToForGuest({ contactEmail: HOST_PERSONAL })).toBeNull();
    expect(
      hostReplyToForGuest({ contactEmail: HOST_PERSONAL, showEmailToGuests: false }),
    ).toBeNull();
    expect(
      hostReplyToForGuest({ contactEmail: "  ", showEmailToGuests: true }),
    ).toBeNull();
    expect(
      hostReplyToForGuest({ contactEmail: " Host.Personal@iCloud.example ", showEmailToGuests: true }),
    ).toBe(HOST_PERSONAL);
  });
});

describe("dispatchers", () => {
  it("dispatchEmail sends to one address only", async () => {
    await dispatchEmail({
      to: GUEST,
      subject: "s",
      body: "b",
      conversationId: CONV,
      fromPartyName: "Hugh Roberts",
      force: true,
      threadRole: "GUEST",
    });
    expect(headerAddresses(payloads[0])).toEqual([GUEST]);
    const h = payloads[0].headers as Record<string, string>;
    expect(h["List-Unsubscribe"]).toBe("<https://example.test/one-click>");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(typeof payloads[0].text).toBe("string");
  });

  it("dispatchPlatformEmail ignores a person's address as Reply-To", async () => {
    await dispatchPlatformEmail({
      to: GUEST,
      subject: "s",
      text: "t",
      replyTo: HOST_PERSONAL,
    });
    expect(payloads[0].reply_to).toBeUndefined();
    expect(headerAddresses(payloads[0])).toEqual([GUEST]);
  });
});

describe("source audit", () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) return files(p);
      return /\.tsx?$/.test(n) && !n.endsWith(".test.ts") ? [p] : [];
    });
  }

  it("no email call puts a person's address in Reply-To, CC or BCC", () => {
    const bad: string[] = [];
    for (const f of files(join(process.cwd(), "src"))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\b(replyTo|cc|bcc)\s*:\s*([^,\n}]+)/g)) {
        if (/contactEmail|guestEmail|billingEmail|\.email\b/.test(m[2])) {
          bad.push(`${f}: ${m[0]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("the opt-in Reply-To only ever comes from hostReplyToForGuest", () => {
    const bad: string[] = [];
    for (const f of files(join(process.cwd(), "src"))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\bhostOptInReplyTo\s*:\s*([^,\n}]+)/g)) {
        if (!/^hostReplyToForGuest\(/.test(m[1].trim())) bad.push(`${f}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
