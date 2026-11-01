import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const handleInboundEmail = vi.hoisted(() => vi.fn());
const fetchReceivedEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/inbound/handle", () => ({ handleInboundEmail }));
vi.mock("@/lib/inbound/resend-receiving", async (orig) => ({
  ...(await orig<typeof import("@/lib/inbound/resend-receiving")>()),
  fetchReceivedEmail,
}));

import { POST } from "./route";
import { TransientInboundError } from "@/lib/inbound/resend-receiving";

const KEYS = [
  "INBOUND_EMAIL_DOMAIN",
  "INBOUND_EMAIL_TOKEN_SECRET",
  "RESEND_INBOUND_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "MESSAGING_EMAIL_API_KEY",
];
const saved: Record<string, string | undefined> = {};
const key = Buffer.from("route-test-key");

function enable() {
  process.env.INBOUND_EMAIL_DOMAIN = "reply.example.test";
  process.env.INBOUND_EMAIL_TOKEN_SECRET = "test-secret-0123456789abcdef";
  process.env.RESEND_INBOUND_WEBHOOK_SECRET = `whsec_${key.toString("base64")}`;
  process.env.RESEND_API_KEY = "re_test";
}

function req(body: object, opts: { badSig?: boolean } = {}) {
  const raw = JSON.stringify(body);
  const id = "msg_1";
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", opts.badSig ? Buffer.from("x") : key)
    .update(`${id}.${ts}.${raw}`)
    .digest("base64");
  return new Request("https://x.test/api/inbound/email", {
    method: "POST",
    headers: {
      "svix-id": id,
      "svix-timestamp": ts,
      "svix-signature": `v1,${sig}`,
    },
    body: raw,
  });
}

const received = { type: "email.received", data: { email_id: "e-123456" } };

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  for (const k of KEYS) delete process.env[k];
  vi.clearAllMocks();
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("POST /api/inbound/email", () => {
  it("is off (404) when the env vars are not set", async () => {
    const r = await POST(req(received));
    expect(r.status).toBe(404);
    expect(fetchReceivedEmail).not.toHaveBeenCalled();
  });

  it("rejects a bad signature", async () => {
    enable();
    const r = await POST(req(received, { badSig: true }));
    expect(r.status).toBe(401);
    expect(fetchReceivedEmail).not.toHaveBeenCalled();
  });

  it("ignores other event types", async () => {
    enable();
    const r = await POST(req({ type: "email.sent", data: {} }));
    expect(r.status).toBe(200);
    expect(fetchReceivedEmail).not.toHaveBeenCalled();
  });

  it("fetches the email and hands it to the thread handler", async () => {
    enable();
    fetchReceivedEmail.mockResolvedValue({
      id: "e-123456",
      from: "a@b.test",
      to: [],
    });
    handleInboundEmail.mockResolvedValue({
      status: "added",
      conversationId: "c",
      messageId: "m",
    });
    const r = await POST(req(received));
    expect(r.status).toBe(200);
    expect(fetchReceivedEmail).toHaveBeenCalledWith("e-123456");
    expect(handleInboundEmail).toHaveBeenCalled();
  });

  it("returns 500 on a transient failure so Resend retries", async () => {
    enable();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchReceivedEmail.mockRejectedValue(
      new TransientInboundError("resend 503"),
    );
    const r = await POST(req(received));
    expect(r.status).toBe(500);
  });
});
