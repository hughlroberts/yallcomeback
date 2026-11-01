import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySvixSignature } from "./svix";

const key = Buffer.from("super-secret-test-key");
const secret = `whsec_${key.toString("base64")}`;
const now = new Date("2026-11-01T15:00:00Z");
const ts = String(Math.floor(now.getTime() / 1000));
const body = JSON.stringify({
  type: "email.received",
  data: { email_id: "e1" },
});
const sign = (id: string, t: string, b: string) =>
  `v1,${createHmac("sha256", key).update(`${id}.${t}.${b}`).digest("base64")}`;

describe("verifySvixSignature", () => {
  it("accepts a valid signature (also among several)", () => {
    const sig = sign("msg_1", ts, body);
    expect(
      verifySvixSignature({
        secret,
        id: "msg_1",
        timestamp: ts,
        signature: sig,
        body,
        now,
      }),
    ).toBe(true);
    expect(
      verifySvixSignature({
        secret,
        id: "msg_1",
        timestamp: ts,
        signature: `v1,AAAA ${sig}`,
        body,
        now,
      }),
    ).toBe(true);
  });

  it("rejects tampered bodies, wrong ids, old timestamps and missing headers", () => {
    const sig = sign("msg_1", ts, body);
    const base = {
      secret,
      id: "msg_1",
      timestamp: ts,
      signature: sig,
      body,
      now,
    };
    expect(verifySvixSignature({ ...base, body: body + " " })).toBe(false);
    expect(verifySvixSignature({ ...base, id: "msg_2" })).toBe(false);
    const old = String(Number(ts) - 6 * 60);
    expect(
      verifySvixSignature({
        ...base,
        timestamp: old,
        signature: sign("msg_1", old, body),
      }),
    ).toBe(false);
    expect(verifySvixSignature({ ...base, signature: null })).toBe(false);
    expect(verifySvixSignature({ ...base, secret: "whsec_b3RoZXI=" })).toBe(
      false,
    );
  });
});
