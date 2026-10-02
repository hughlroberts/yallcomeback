# QA Report — yallcomeback / vacation-rentals

**Date:** 2026-09-30  
**Scope:** Multi-agent full pass on commit `09f3699` (ops nesting, listing deposits, host-signup polish) plus a security review of related auth/billing surfaces.  
**Target:** https://www.yallcomeback.app  
**Branch:** main  

**Verdict:** Required P0/P1 holes from this pass are **fixed in the follow-up commit**. Items that need a product call stay open as P1–PN below.

---

## How this pass ran

Five parallel reviewers (security, payments/Connect, Ops/Admin routing, public/host UX, diff regressions), plus local tooling and an anonymous production probe.

---

## Tooling

| Command | Result |
|---------|--------|
| `./node_modules/.bin/tsc --noEmit` | **PASS** |
| `npm run lint` | **PASS** (0 errors) |
| Railway deploy `09f3699` (`dfddaac2`) | **SUCCESS** (then superseded by this QA-fix deploy) |
| Local Prisma vs SQLite `.env` | Still mismatched (historical P0-2 docs-only) |

---

## Production probe (anonymous, pre QA-fix deploy)

| Path | Auth | Status |
|------|------|--------|
| `/` `/marketplace` `/for-hosts` `/login` `/help` `/about` `/contact` `/saved` `/self-host` `/open-source` | anon | 200 |
| `/h/cherokee-landing` `/stays` `/about` | anon | 200 |
| `/h/cherokee-landing/services` | anon | 307 → `/h/cherokee-landing/boat-rentals` (custom services path) |
| `/llms.txt` `/agents.md` `/api/v1/openapi.json` `/robots.txt` `/sitemap.xml` `/.well-known/ai-plugin.json` | anon | 200 |
| `/admin` `/account` `/messages` | anon | 307 → login |
| `/ops` `/ops/hosting` `/ops/settings` `/ops/pricing-comps` `/ops/managers` `/ops/health` `/ops/backups` | anon | 307 → login (`admin_only`) |
| `/api/cron/sync-ical` `/api/cron/hosting-payments` `/api/cron/booking-messages` | unauth | **401** `{"error":"Unauthorized"}` |
| `/api/stripe/webhook` GET | — | 405 (POST only) |

Cron fail-closed (prior P0-1) still holds in production.

---

## Findings

### P0 — Broken, data loss, or security (fixed this pass)

#### P0-1 — Marketplace card-only was client-controlled
- **Where:** `src/app/actions/bookings.ts`, `src/app/book/[slug]/page.tsx`, `src/lib/host-payments.ts`
- **What:** `sourceChannel` / `via` / missing `channel` (defaulted to `host_site`) let a Find a Place guest POST a non-card deposit when the listing website method was MANUAL/BTC/in-person.
- **Fix:** Ignore form/query channel. Derive from middleware tenant vs listing host. No tenant match → marketplace → card only.

#### P0-2 — Complimentary hosts could be auto-promoted back to paid
- **Where:** `src/app/actions/hosting.ts`, `src/lib/platform-billing.ts`
- **What:** Pause was not always persisted. Checkout/webhook paths that omit `pause_collection` overwrote `"paused"` and `promoteComplimentaryHostIfPaid` put them on $25/$5.
- **Fix:** Leaving paid always sets `stripeSubscriptionStatus: "paused"` (and pauses Stripe when a live sub exists). `applyHostingSubscriptionFromStripe` keeps paused unless the event actually includes `pause_collection`.

---

### P1 — Wrong behavior users will hit (fixed this pass)

#### P1-1 — Host signup mass-approved every `PENDING_REVIEW` brand
- **Where:** `src/app/actions/host.ts` (`registerHost`, `startHosting`)
- **What:** `updateMany` with only `approvalStatus: PENDING_REVIEW` after creating one self-serve host.
- **Fix:** Deleted both blocks. New hosts are already created `APPROVED`.

#### P1-2 — Guest message `bookingId` IDOR
- **Where:** `src/app/actions/messages.ts`
- **What:** Client booking cuid attached with no check that it belongs to this guest and this host. Conversation UI could show another stay’s dates and admin notes.
- **Fix:** Attach booking only when it exists, `property.hostId` matches the conversation host, property matches if given, and guest user/email matches.

#### P1-3 — HOST sent to `/ops` via `/admin/pricing`
- **Where:** `next.config.ts`, `src/app/admin/pricing/**`, `src/app/actions/pricing-intelligence.ts`
- **What:** Config + pages always 302 into Ops. Middleware then bounced HOST to `/admin?error=admin_only`. Hosts could also start a pricing run.
- **Fix:** Drop `/admin/pricing*` config redirects. Platform → Ops; HOST stays on a short admin card. `startPricingResearch` is `requirePlatformAdmin`. Addon checkout return URLs land on `/admin` for hosts.

#### P1-4 — Signup `planId` from the form
- **Where:** `src/app/actions/host.ts` `registerHost`
- **What:** Client plan id used when paid slug match missed, so a complimentary id could stick.
- **Fix:** Same as `startHosting`: paid `monthlyPrice > 0` only. Form `planId` ignored.

---

### P1 — Closed by decision

#### P1-6 — JWT `role` / `hostId` refresh
- **Where:** `src/lib/auth.ts` (`ROLE_REFRESH_MS = 5_000` on the Node jwt callback). Edge `auth.config.ts` has no DB.
- **Decision (2026-10-02):** Done. Do not change the interval. Do not force re-login after Ops role changes. `/ops`, `requirePlatformAdmin`, `requireHostAdmin`, and the admin layout already DB-gate. Leftover cookie lag on a few message helpers is not a hole.

### P1 — Needs review (not shipped)

| ID | Summary | Why it needs a call |
|----|---------|---------------------|
| **P1-5** | Leaving complimentary does not resume Stripe (`pause_collection: void` stays). Ops $0 → paid and the host “subscribe” button open Billing Portal instead of Checkout. | Resume vs cancel+new Checkout vs leave paused until they add a card. Do not invent extra Stripe resume/cancel behavior without you. |
| **P1-7** | Booking double-submit race reduced (`$transaction` + re-check) but no DB exclusion constraint. | Full isolation needs a schema/constraint decision. |

---

### P2 — Polish / hygiene (some fixed, rest flagged)

**Fixed**
- Wizard price save no longer resets listing deposit method to STRIPE when the field is omitted.
- Guest confirmation copy no longer says “Stripe”.
- Help “Apply” no longer describes pending → approved wait.
- Market comps page now `requirePlatformAdmin` like its siblings.

**Needs review**

| ID | Summary |
|----|---------|
| **P2-1** | LIMITED co-hosts can set `websitePaymentMethod` via listing update (`assertPropertyAccess` only). Dedicated saver already requires `canManageBrand`. |
| **P2-2** | Public `/api/v1/listings/{slug}` returns host email/phone and street address (CORS `*`). Agent-native by design vs PII harvest. |
| **P2-3** | `buyConnectedProduct` still trusts client `amountCents`. Extras storefront is `notFound()`, but the action is callable. |
| **P2-4** | `markDepositPaid` maps `IN_PERSON_CARD` to `MANUAL`. |
| **P2-5** | Connect onboard origin prefers `NEXT_PUBLIC_SITE_URL` over the request host (local/preview can 303 to prod). |
| **P2-6** | Leftover `/ops/backups/download` and `file/[name]` handlers duplicate the nested settings routes. Config redirects; drift risk. |
| **P2-7** | Brand logo card is visually mid-page (`order-4`) but last in DOM/tab order. |
| **P2-8** | Marketplace Where prefills the sole city but the count line stays “we're new…” until they search. Intended; easy to misread. |
| **P2-9** | Paid signup “Yes, collect cards” goes to Connect onboard, not hosting Subscription — easy to skip the monthly hosting card. |
| **P2-10** | Native Connect POST has no Origin check. Cookies are SameSite=Lax so classic cross-site POST should not send the session; confirm if you want a belt-and-suspenders Origin check. |
| **P2-11** | No automated e2e suite. |

---

### P3

| ID | Summary |
|----|---------|
| **P3-1** | Unfiltered marketplace always says “we're new and still getting started”, even after inventory grows. |
| **P3-2** | Discovery rails still use “anywhere” in `formatContinueSearchText`. |
| **P3-3** | Brand-switcher “Exit to Ops” is `/ops` with a brand selected and `/ops/hosting` with none. |

---

## Explicit non-findings (controls that still hold)

- Cron: missing secret 503, bad bearer 401. Production cron routes 401 without a bearer.
- Booking confirmation: HMAC token, matching guest, or same-brand HOST/ADMIN. No public PII IDOR on the id alone.
- `/ops` is ADMIN in middleware + `requirePlatformAdmin` in layout.
- `/admin` `/account` `/messages` require login.
- Backup file names allowlisted (`yallcomeback-backup-…json.gz`); both route trees require platform admin.
- Stripe snapshot + thin webhooks fail closed without signature/secret.
- Connect onboard: `requireHostAdmin` + `canManageBrand`; HOST cannot pass another hostId.
- Uploads: path allowlist + magic-byte sniff + UUID names.
- Login `callbackUrl` goes through `safeInternalPath`.
- Two ways to host cards are static `<div>`s locally (live after `09f3699` deploy; arrows gone).
- `STRIPE_LIVE_READY` is true. Stay commission stays 0 unless env is set.
- Payments tab is Connect-only; listing deposit method is per listing.

---

## Status table

| ID | Severity | Status |
|----|----------|--------|
| P0-1 marketplace channel | P0 | **fixed** |
| P0-2 complimentary re-promote | P0 | **fixed** |
| P1-1 mass approve | P1 | **fixed** |
| P1-2 message bookingId | P1 | **fixed** |
| P1-3 HOST → Ops pricing | P1 | **fixed** |
| P1-4 signup planId | P1 | **fixed** |
| P1-5 resume Stripe after complimentary | P1 | **needs review** |
| P1-6 JWT role refresh | P1 | **done** |
| P1-7 booking exclusion constraint | P1 | **needs review** |
| P2-1…P2-11 | P2 | **needs review** (wizard/copy/help/comps auth **fixed**) |
| P3-1…P3-3 | P3 | **needs review** |
| Prior P0-1 cron | P0 | **holds** (prod 401) |
| Prior P0-3 confirmation | P0 | **holds** |

---

## Not done without a decision

- Resume or cancel a paused Stripe hosting subscription when Ops moves $0 → paid.
- Agent API contact-field policy.
- LIMITED co-host vs brand money settings.

## Closed by decision

- Hosting-payments GitHub Action: leave untracked; local `.github/workflows/cron-hosting-payments.yml` deleted. In-process Railway cron is primary. Tracked `cron.yml` already pings iCal + messages. Do not add a second GHA cron. Fold a daily hosting-payments ping into `cron.yml` only if Ops health later shows a missed day.

---

*Phase 1 audit + Phase 2 required fixes. Open P1–PN are for review, not silent product changes.*
