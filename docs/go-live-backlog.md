# Go-live backlog

Work that is decided but not started. Newest first.

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
**Intended address:** `hello@yallcomeback.app`

Do not advertise this inbox on guest or host screens until the items below are done. In-app messaging stays the path for guests and hosts.

When picked up:

1. Create the `hello@yallcomeback.app` mailbox (or a catch-all) and DNS (MX + SPF; DKIM when the sender is live).
2. Set production env: `MESSAGING_EMAIL_FROM`, `RESEND_API_KEY` (or SMTP). Keep SMS off.
3. Smoke-test: guest message → host email; host reply → guest email; booking auto-message.
4. Put `hello@yallcomeback.app` back on `/contact` and Admin → Website hosting.
5. Confirm Ops → Settings no longer shows email as placeholder.

Related: `PRODUCT_EMAIL` / `PRODUCT_DOMAIN` in `src/lib/features.ts`, Ops → Settings → Messaging.
