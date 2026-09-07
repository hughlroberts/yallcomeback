# Go-live backlog

Work that is decided but not started. Newest first.

## Auto fridge magnet after a stay is booked (TBD)

**Status:** deferred — idea only, do not build yet  
**Related:** Admin → Fridge magnets (print-one QR page already exists)

When a guest **purchases / confirms a listing stay**, automatically send them a fridge magnet (QR back to that listing / host) so they book again without searching.

Open questions before implementation:

1. **Physical vs digital** — Mail a printed magnet, email a print-at-home PDF, or both?
2. **Trigger** — Deposit paid, stay confirmed, or after checkout?
3. **Address** — Collect mailing address at booking, or only email a PDF until we have an address?
4. **Who pays / fulfills** — Yall Come Back ships, the host ships, or a print vendor (Sticker Mule, etc.)?
5. **Which listings** — Every stay, host opt-in, or platform-paid hosts only?
6. **Repeat guests** — One magnet per guest per listing, or every booking?

Existing building block: `src/components/fridge-magnet.tsx`, `/admin/magnets/[propertyId]`. Do not start fulfillment, postage, or address fields until the questions above are decided.

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

Channel rules are already in the app: marketplace always card; host website uses one default (card unless the host changes it); custom calendar stays pick a method per block.

When picked up, do **card (Connect) and Bitcoin in the same pass**. Connect code is in the app; keys are not.

### Card (Stripe Connect)

1. Create the platform Stripe account (test first, then live).
2. Env (never commit): `STRIPE_ENABLED=true`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_THIN_WEBHOOK_SECRET`, `STRIPE_HOSTING_PRICE_ID`.
3. Snapshot webhook `POST /api/stripe/webhook` (Checkout, invoices, `customer.subscription.*`).
4. Thin Connect destination `POST /api/stripe/thin-webhook` for `v2.core.account[requirements].updated` and merchant/customer capability updates (payload style Thin).
5. Host: Admin → Payments → Onboard to collect payments. Guest: card deposit on a listing, or extras at `/pay/[hostSlug]`.
6. Smoke-test hosting Subscribe + billing portal. Then `STRIPE_LIVE_READY = true`.

### Bitcoin (stay deposits)

Bitcoin is for guest stay deposits only — not hosting invoices. Hosts still paste the tx id in Admin to mark paid. No processor.

1. Decide the receive wallet: one platform address for now (`BITCOIN_ADDRESS`). Per-host addresses can wait.
2. Use a dedicated deposit wallet (not a personal spending wallet). Mainnet for live; testnet only while rehearsing.
3. Set production env: `BITCOIN_ENABLED=true`, `BITCOIN_ADDRESS=bc1q…`, `BITCOIN_NETWORK=mainnet`, `BITCOIN_LABEL=Yall Come Back deposit`.
4. Smoke-test: guest chooses Bitcoin at checkout, sees the BIP21 wallet link and USD→BTC quote, sends a small amount, host marks the booking paid with the tx id.
5. Confirm Ops → Settings shows a valid address. Smoke-test a host-website default of Bitcoin, and a custom calendar stay paid in Bitcoin.

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
