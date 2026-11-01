import { createHmac, timingSafeEqual } from "node:crypto";

/** Max clock skew for a webhook timestamp (replay window), as Svix uses. */
export const WEBHOOK_TOLERANCE_SEC = 5 * 60;

/**
 * Verify a Svix-signed webhook (Resend webhooks are sent through Svix).
 * Signed content is `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256
 * with the base64 key after the "whsec_" prefix; the header holds one or
 * more space-separated "v1,<base64>" signatures.
 */
export function verifySvixSignature(opts: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now?: Date;
}): boolean {
  const { id, timestamp, signature } = opts;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isInteger(ts)) return false;
  const nowSec = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSec - ts) > WEBHOOK_TOLERANCE_SEC) return false;

  const raw = opts.secret.startsWith("whsec_")
    ? opts.secret.slice("whsec_".length)
    : opts.secret;
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    return false;
  }
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${opts.body}`)
    .digest();
  for (const part of signature.split(" ")) {
    const [version, sig] = part.split(",", 2);
    if (version !== "v1" || !sig) continue;
    let got: Buffer;
    try {
      got = Buffer.from(sig, "base64");
    } catch {
      continue;
    }
    if (got.length === expected.length && timingSafeEqual(got, expected)) {
      return true;
    }
  }
  return false;
}
