/**
 * Read a received email from Resend. The `email.received` webhook only
 * carries metadata, so the body is fetched with the API key.
 */

export type ReceivedEmail = {
  id: string;
  from: string;
  to: string[];
  cc?: string[] | null;
  received_for?: string[] | string | null;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string> | null;
  authentication?: {
    spf?: string | null;
    dkim?: string | null;
    dmarc?: string | null;
  } | null;
};

export class TransientInboundError extends Error {}

const ID_RE = /^[A-Za-z0-9_-]{6,80}$/;

export async function fetchReceivedEmail(
  emailId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReceivedEmail | null> {
  if (!ID_RE.test(emailId)) return null;
  const key =
    process.env.MESSAGING_EMAIL_API_KEY?.trim() ||
    process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  let res: Response;
  try {
    res = await fetchImpl(
      `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}?html_format=cid`,
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch (e) {
    throw new TransientInboundError(`fetch failed: ${(e as Error).message}`);
  }
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    // Sending-only keys can't read received mail; needs a full-access key.
    console.error("[inbound-email] Resend key cannot read received emails");
    throw new TransientInboundError(`resend ${res.status}`);
  }
  if (!res.ok) throw new TransientInboundError(`resend ${res.status}`);
  const j = (await res.json()) as Partial<ReceivedEmail> & {
    data?: Partial<ReceivedEmail>;
  };
  const e = (j.data ?? j) as Partial<ReceivedEmail>;
  if (!e || typeof e.from !== "string") return null;
  return {
    id: emailId,
    from: e.from,
    to: Array.isArray(e.to) ? e.to : e.to ? [String(e.to)] : [],
    cc: e.cc ?? null,
    received_for: e.received_for ?? null,
    subject: e.subject ?? null,
    text: e.text ?? null,
    html: e.html ?? null,
    headers: e.headers ?? null,
    authentication: e.authentication ?? null,
  };
}
