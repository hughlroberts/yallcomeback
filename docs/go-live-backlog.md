# Go-live backlog

Work that is decided but not started. Newest first.

## Analytics and errors (delayed)

**Status:** deferred — turn on soon  
**Stack:** Railway (already) + Sentry + Umami  
**Issue:** [#3](https://github.com/hughlroberts/yallcomeback/issues/3)

Railway already covers container health (logs, CPU/memory, failed-deploy alerts). Add Sentry for app errors and Umami for privacy-first page analytics. Do **not** add Google Analytics.

### Keep using Railway

1. Observability logs (`@level:error`, HTTP 5xx).
2. One monitor on memory/CPU.
3. Webhook or email on failed deploy / crash.

### Sentry (errors)

1. Create a Sentry project for the Next.js app.
2. SDK in the app; production env: `SENTRY_DSN` (and Next.js build tokens as required). Set `environment` from `RAILWAY_ENVIRONMENT_NAME`, `release` from the deploy id.
3. Leave session replay **off** unless checkout bugs need it (it records UI).
4. Smoke-test: throw a test error in production, confirm it groups in Sentry with a stack trace.

### Umami (analytics)

1. Deploy the Umami template on the same Railway project (own Postgres or a dedicated DB). Change the default password immediately.
2. Add `yallcomeback.app` (and later host custom domains if you want those counted).
3. Load the tracker only in production, from env (`NEXT_PUBLIC_UMAMI_URL`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID`).
4. Custom events: marketplace search, listing view, booking request, host apply.
5. Update Privacy Policy cookies / analytics section: Umami is first-party, no ads, we do not sell data.

Related: `src/app/layout.tsx`, `/privacy` § cookies.

## Payments (delayed)

**Status:** deferred — keep manual deposits and hosting invoices  
**Flags:** `STRIPE_LIVE_READY = false`; `BITCOIN_ENABLED=false`  
**Issue:** [#2](https://github.com/hughlroberts/yallcomeback/issues/2)

Do not turn on card checkout, hosted invoices, or Bitcoin deposits until the items below are done. Guests already see that online card payments are not enabled. Hosts mark deposits and invoices paid in Admin.

When picked up, do **card and Bitcoin in the same pass**.

### Card (Stripe)

1. Create the Stripe account (test first, then live).
2. Set production env only (never commit): `STRIPE_ENABLED=true`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
3. Webhook: `POST /api/stripe/webhook` for `invoice.paid` and `invoice.payment_succeeded`.
4. Smoke-test a hosting invoice and a guest card deposit, then set `STRIPE_LIVE_READY = true`.
5. Confirm Ops → Settings shows Stripe as live, and booking no longer says card payments are off.

### Bitcoin (stay deposits)

Bitcoin is for guest stay deposits only — not hosting invoices. Hosts still paste the tx id in Admin to mark paid. No processor.

1. Decide the receive wallet: one platform address for now (`BITCOIN_ADDRESS`). Per-host addresses can wait.
2. Use a dedicated deposit wallet (not a personal spending wallet). Mainnet for live; testnet only while rehearsing.
3. Set production env: `BITCOIN_ENABLED=true`, `BITCOIN_ADDRESS=bc1q…`, `BITCOIN_NETWORK=mainnet`, `BITCOIN_LABEL=Yall Come Back deposit`.
4. Smoke-test: guest chooses Bitcoin at checkout, sees the BIP21 wallet link and USD→BTC quote, sends a small amount, host marks the booking paid with the tx id.
5. Confirm Ops → Settings shows a valid address, and booking offers Bitcoin next to card / manual.

Related: `src/lib/stripe.ts`, `src/lib/bitcoin.ts`, Ops → Settings → Stripe and Bitcoin.

## Email (delayed)

**Status:** deferred until we are ready to receive mail  
**Issue:** [#1](https://github.com/hughlroberts/yallcomeback/issues/1)

Airbnb-style envelope (already in code). We send; hosts never give us their Gmail.

| Kind | From | Reply-To |
| --- | --- | --- |
| Stay mail to guest | `Cherokee Landing via Yall Come Back <bookings@yallcomeback.app>` | host contact |
| Stay mail to host | `Guest Name via Yall Come Back <bookings@yallcomeback.app>` | guest email |
| Platform / ops | `Yall Come Back <bookings@yallcomeback.app>` | — |

Do **not** send as `stay@cherokeelanding.net` or the host’s iCloud. Custom-domain From is a later optional feature (DNS DKIM on their domain).

When picked up:

1. Verify `yallcomeback.app` on Resend (SPF + DKIM + DMARC). Use one sending mailbox: `bookings@yallcomeback.app`.
2. Optional later: `hello@yallcomeback.app` as the public contact inbox (same domain). Do not advertise it until it is monitored.
3. Set production env: `MESSAGING_EMAIL_FROM="Yall Come Back <bookings@yallcomeback.app>"`, `RESEND_API_KEY`. Keep SMS off.
4. Smoke-test: guest message → host mail shows guest name via Yall Come Back, Reply-To is the guest; host reply → guest mail shows host name via Yall Come Back, Reply-To is the host; booking auto-message same as host→guest. In-app link still works.
5. Confirm Ops → Settings shows email transport live.

Related: `src/lib/messaging.ts` (`stayFromHeader` / `platformFromHeader`), Ops → Settings → Messaging.
