# Reply by email (one thread for email and messages)

When it is on, every stay email (new question, guest reply, host reply,
booking confirmation, cancellation, automated booking messages) goes out with
a per-thread Reply-To such as `reply+c-h-<conversation id>-<signature>@<inbound domain>`.
Replying from any mail app adds the reply to the matching conversation in
/admin/messages and the guest's /messages view, and the other side is
emailed as usual. Flood digests keep a normal reply link (no thread address).

## Env vars (Railway → web service → Variables)

| Name                                          | What                                                               |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `INBOUND_EMAIL_DOMAIN`                        | The receiving domain, e.g. `reply.yallcomeback.app`                |
| `INBOUND_EMAIL_TOKEN_SECRET`                  | Random string, 32+ characters, used to sign reply addresses        |
| `RESEND_INBOUND_WEBHOOK_SECRET`               | Signing secret (`whsec_…`) from the Resend webhook page            |
| `RESEND_API_KEY` or `MESSAGING_EMAIL_API_KEY` | Already set. Must be allowed to read received emails (full access) |

If any is missing the feature is off: emails keep today's Reply-To and
`/api/inbound/email` returns 404. Changing `INBOUND_EMAIL_TOKEN_SECRET`
invalidates reply addresses in emails already sent.

## Setup (Resend inbound)

1. Resend → Domains → add `reply.yallcomeback.app` (or open it if it exists) → turn on **Receiving**.
2. At the DNS host for yallcomeback.app, add the MX record Resend shows for that
   subdomain (host `reply`, value as shown on the Resend page, lowest priority number).
   Use a subdomain so the root domain's existing mail is untouched.
3. Wait until Resend shows the receiving record as verified.
4. Resend → Webhooks → Add endpoint: `https://www.yallcomeback.app/api/inbound/email`,
   event `email.received`. Copy its signing secret.
5. Railway: add the three new env vars above and redeploy.
6. Test: send yourself a question on a test listing, reply to the email, and
   check the reply appears in /admin/messages.

## Protections

- Svix signature check on the webhook (5-minute timestamp window).
- HMAC-signed thread token; forged or edited addresses are ignored.
- Sender must be on the thread: the guest's address for guest tokens; brand
  contact/billing email or a host/admin user for host tokens.
- Mail failing DMARC (or both SPF and DKIM) is ignored, as are auto-replies,
  bounces and mailing-list mail.
- Rate limits: 20 per sender and 30 per thread per hour (in memory).
- Webhook retries are deduped by Resend's email id; near-duplicate repeats
  within 24 hours are skipped; guest replies go through the same spam/link
  filter as the question form.
- Quoted text, "On … wrote:", Outlook headers, "Sent from my iPhone" and `-- `
  signatures are removed. Replies longer than 2,000 characters are cut.

## Alternative without Resend inbound

Cloudflare Email Routing (catch-all on the inbound subdomain) → an Email
Worker that posts the message to this webhook would also work, but the route
currently expects Resend's signed `email.received` event and fetches the body
from Resend, so it would need a small adapter. Resend inbound is the supported path.
