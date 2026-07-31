# QA Report — yallcomeback / vacation-rentals

**Date:** 2026-07-30  
**Scope:** Full static + tooling + production probe audit (Phase 1).  
**Local runtime note:** Local `DATABASE_URL=file:./dev.db` while Prisma provider is `postgresql` → local pages return **500**. Production (Railway Postgres) serves successfully.

---

## Stack summary

| Area | Choice |
|------|--------|
| Framework | Next.js **16.2.10** (App Router), React **19.2.4** |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Data | Prisma 6 + PostgreSQL (production); schema provider **postgresql** only |
| Auth | Auth.js / next-auth **v5 beta** (credentials + JWT session) |
| Roles | `ADMIN` (platform), `HOST`, `GUEST` |
| Payments | Stripe (optional), Bitcoin (optional), manual deposits |
| Deploy | Railway Docker (`Dockerfile` + `railway.toml`) |
| Tests | **None** (`npm test` → missing script) |

---

## Tooling results (Phase 1)

| Command | Result |
|---------|--------|
| `npm install` | Already installed (`node_modules` present) |
| `npx tsc --noEmit` | **PASS** (exit 0) |
| `npm run lint` | **FAIL** — 25 errors, 4 warnings (see P2) |
| `npm run build` | **PASS** (production build succeeds) |
| `npm test` | **FAIL** — no test script / no test suite |
| `npx prisma validate` (local `.env`) | **FAIL** — SQLite URL vs `postgresql` provider |
| Local `GET /` | **500** (DB provider mismatch) |
| Production `GET /` | **200** |
| Production `GET /api/cron/sync-ical` (no auth) | **200** `{"synced":0,"results":[]}` — open |
| Production `GET /ops` (anon) | **307** → login (layout gate works) |
| Production `GET /admin` (anon) | **307** → login |

---

## Route inventory

### Public (no auth)

| Path | Auth | Data / mutations |
|------|------|------------------|
| `/` | Public | Marketplace listings, featured host |
| `/marketplace` | Public | Search + listings |
| `/marketplace/properties/[slug]` | Public | Listing detail; query `host=` scopes brand |
| `/properties`, `/properties/[slug]` | Public | Redirect → marketplace |
| `/locations`, `/locations/[slug]` | Public | Location pages |
| `/hosts` | Public | Host list |
| `/h/[hostSlug]` (+ calendar, locations, properties) | Public | Host brand site (microsite) |
| `/book/[slug]` | Public | Booking form → `createBooking` |
| `/book/confirmation/[id]` | **Public if ID known** | Booking + payment PII (see P0-3) |
| `/about`, `/contact`, `/help`, `/help/[slug]` | Public | Static / content |
| `/for-hosts`, `/self-host`, `/open-source` | Public | Marketing; host signup |
| `/login`, `/register` | Public | Auth |
| `/saved` | Public (localStorage) | Client-only wishlist |
| `/api/auth/[...nextauth]` | Public | Auth handlers |
| `/api/marketplace/stays` | Public | JSON search (capped take≤24) |
| `/api/ical/[propertyId]/[secret]` | Secret in URL | iCal export |
| `/api/stripe/webhook` | Stripe signature | Webhooks |
| `/api/cron/*` | Bearer **if** `CRON_SECRET` set | See P0-1 |

### Authenticated guest

| Path | Auth | Notes |
|------|------|-------|
| `/account/*` | Logged-in | Middleware `authorized` for `/account` |
| `/messages`, `/messages/[id]` | Logged-in (page-level) | **Not** in middleware `authorized` (P1) |
| Account settings taxes | Logged-in | Host-only features gated by role in page |

### Host admin (`HOST` or `ADMIN`)

| Path | Auth | Data / mutations |
|------|------|------------------|
| `/admin` layout | HOST/ADMIN | Layout + middleware |
| `/admin`, properties, bookings, earnings, messages, magnets, guest-messages | Host-scoped via `requireHostAdmin` / `assertPropertyAccess` | Server actions under `src/app/actions/*` |
| `/admin/hosting`, `/admin/hosting/plans`, `/admin/settings` | Layout allows HOST | **Redirect to `/ops/*`** → HOST blocked (P1-1) |
| `/admin/earnings/paid/export` | `requireHostAdmin` | CSV export |

### Platform ops (`ADMIN` only)

| Path | Auth | Notes |
|------|------|-------|
| `/ops/*` | `requirePlatformAdmin` in layout | Hosting, plans, managers, settings |
| Actions `src/app/actions/hosting.ts`, `managers.ts` | Platform admin | Approvals, invoices, managers |

---

## Findings

### P0 — Broken, data loss, or security

#### P0-1 — Cron APIs unauthenticated when `CRON_SECRET` is unset
- **Where:** `src/app/api/cron/sync-ical/route.ts:10-16`, `src/app/api/cron/booking-messages/route.ts:10-17`
- **What:** Auth is only enforced `if (secret)`. Production Railway env: **`CRON_SECRET` MISSING**. Anon `GET /api/cron/sync-ical` returns **200** and runs sync.
- **Repro:** `curl https://yallcomeback-production.up.railway.app/api/cron/sync-ical`
- **Fix:** Fail closed: require `CRON_SECRET` always; return 401 if missing or wrong. Set secret in Railway.

#### P0-2 — Local app hard-broken (Postgres schema vs SQLite `.env`)
- **Where:** `prisma/schema.prisma:7-11`, local `.env` `DATABASE_URL="file:./dev.db"`
- **What:** Prisma rejects non-postgres URL; every DB page **500** locally.
- **Repro:** `npm run dev` → open `/` or `/marketplace`
- **Fix:** Point local `DATABASE_URL` at Postgres (docker-compose) **or** document dual-provider workflow; update `.env.example` with explicit Postgres local URL. No schema migration required if using compose Postgres.

#### P0-3 — Booking confirmation is an unauthenticated IDOR
- **Where:** `src/app/book/confirmation/[id]/page.tsx:27-34` (+ render of email/phone/payment)
- **What:** Anyone who knows/guesses a booking cuid can load guest name, email, phone, deposit amounts, Bitcoin address, etc. No session/token check.
- **Repro:** Create booking → open `/book/confirmation/{id}` in private window.
- **Fix:** Require signed-in guest matching `guestEmail`/`userId`, or host of property, or a signed confirmation token issued at booking time.

#### P0-4 — Host admin redirects to ops routes hosts cannot open
- **Where:** `src/app/admin/hosting/page.tsx:5`, `admin/hosting/plans/page.tsx:4`, `admin/settings/page.tsx:5` → `/ops/*`; ops layout ADMIN-only
- **What:** A HOST following “hosting/settings” lands on login `admin_only` instead of useful host UI.
- **Repro:** Login as HOST → visit `/admin/hosting`
- **Fix:** Stop redirecting hosts to ops; show host-appropriate content or a clear “platform only” page without forcing ops.

---

### P1 — Wrong behavior users will hit

#### P1-1 — `/messages` not gated in middleware `authorized`
- **Where:** `src/auth.config.ts:27-44` (only `/admin`, `/account`)
- **What:** Rely solely on page `redirect` to login; middleware does not treat messages as protected path consistently with account.
- **Fix:** Add `path.startsWith("/messages")` require login in `authorized`.

#### P1-2 — Booking create race (double-book window)
- **Where:** `src/app/actions/bookings.ts:88-205` — availability check then create without transaction/serializable lock
- **What:** Two concurrent submits can both pass `isRangeAvailable` and create overlapping booking blocks.
- **Repro:** Parallel double-submit same dates (automated).
- **Fix:** Transaction + unique constraint or re-check availability inside transaction; disable button client-side (already partial UX).

#### P1-3 — Property delete still single-step on listing tab
- **Where:** `src/app/admin/properties/[id]/page.tsx` ~Delete property form
- **What:** Hard delete with one click (user previously asked for hard-to-delete UX).
- **Fix:** Two-step confirm + type title (client component), same pattern as photo remove.

#### P1-4 — No automated tests
- **Where:** `package.json` scripts
- **What:** No unit/e2e coverage for auth, booking, pricing.
- **Fix:** Add minimal smoke tests (optional later; mark as hygiene).

#### P1-5 — Platform admin creates properties on “first active host” if no hostId
- **Where:** `src/lib/scope.ts:60-79` `resolveHostIdForCreate`
- **What:** Import/create without host selector can attach listing to wrong brand.
- **Repro:** Admin import without choosing host (if only one path skips selector).
- **Fix:** Require explicit `hostId` for platform admins when >0 hosts.

#### P1-6 — JWT role/hostId never refreshed after admin changes user
- **Where:** `src/lib/auth.ts` jwt callback only on login
- **What:** Role changes need re-login to take effect.
- **Fix:** Re-fetch user in jwt on interval or version claim (P2-acceptable).

---

### P2 — Polish and hygiene

#### P2-1 — ESLint: 25 errors
- `@next/next/no-html-link-for-pages` on wizard steps (`<a href="/admin/properties">`)
- `react-hooks/set-state-in-effect` in photo-gallery, save-listing-button, where-autocomplete, message-host-form
- `prefer-const` in `availability.ts`, `listing-import/extract.ts`
- exhaustive-deps warning in `track-browse-history.tsx`

#### P2-2 — Contact page has no form (email link only)
- Fine for v1; no rate limit needed until form exists.

#### P2-3 — `dangerouslySetInnerHTML` for QR SVG / print CSS
- **Where:** fridge-magnet, magnets page — low risk if SVG generated in-house.

#### P2-4 — No pagination on admin property/booking lists
- Unbounded `findMany` for small dogfood DBs OK; will degrade at scale.

#### P2-5 — Map pin only settable via setup wizard step 3
- UX gap (documented previously); not a security issue.

#### P2-6 — Lint/CI does not fail deploy
- Railway only runs `npm run build`; lint errors ship.

#### P2-7 — Weak local `AUTH_SECRET` in `.env`
- Dev-only; ensure production uses strong secret (Railway has one set).

---

## Explicit non-findings / OK

- Ops layout enforces ADMIN (anon redirected).
- Property mutations use `ensureHostAccess` + `assertPropertyAccess` consistently (sampled).
- Marketplace API caps `take` at 24.
- Build succeeds on Next 16.
- Typecheck clean.

---

## Phase 2 plan (strict severity order)

1. P0-1 Fail-closed cron auth  
2. P0-3 Confirmation access control  
3. P0-4 Host-facing redirects (not to ops)  
4. P0-2 Document/fix local DB guidance (`.env.example` only; no prod migrations)  
5. P1-1 Middleware messages gate  
6. P1-5 Require hostId for platform create when multi-host  
7. P1-3 Two-step property delete  
8. P2 prefer-const + high-value lint (no large refactors)

**Out of scope without decision:** pricing formula changes, schema migrations for new booking tokens (confirmation can use session/email match without migration).

---

## Status table (Phase 3 — verified)

| ID | Severity | Status | Commit | Verification |
|----|----------|--------|--------|--------------|
| P0-1 | P0 | **fixed** | `4702027` | Local `GET /api/cron/sync-ical` → `503` Cron not configured; code requires Bearer |
| P0-2 | P0 | **fixed** (docs) | `6ec8b7a` / `.env.example` | Documented Postgres-only + CRON_SECRET; local `.env` still SQLite until user fixes |
| P0-3 | P0 | **fixed** | `ff0000d` | HMAC token unit-tested; page calls `verifyBookingAccessToken` |
| P0-4 | P0 | **fixed** | `a351c13` | Hosts no longer redirect to `/ops`; admins still do |
| P1-1 | P1 | **fixed** | `c63cd69` | `auth.config` gates `/messages` and `/ops` |
| P1-2 | P1 | **partial** | `2733fcd` | Booking+block in `$transaction` + re-check; still uses non-tx prisma for availability read — residual race under high concurrency |
| P1-3 | P1 | **fixed** | `2733fcd` | Danger zone + type exact title to delete |
| P1-4 | P1 | **skipped** | — | No test framework in repo; adding suite is net-new |
| P1-5 | P1 | **fixed** | `6ec8b7a` | Multi-host requires explicit hostId |
| P1-6 | P1 | **needs decision** | — | JWT role refresh strategy not chosen |
| P2 prefer-const | P2 | **fixed** | `2733fcd` | availability + extract |
| P2 eslint rest | P2 | **skipped** | — | Remaining setState-in-effect / `<a>` Link rules need broader refactors |
| P2 CI lint | P2 | **needs decision** | — | Wire lint into Railway/CI |

### Tooling after fixes

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run lint` | Still fails on pre-existing P2 (wizard `<a>`, setState-in-effect) |
| Local cron without secret | **503** (was open/500 before) |

### Production follow-up (ops, not code)

1. **Set `CRON_SECRET`** on Railway and update cron jobs to send `Authorization: Bearer …`  
2. **Merge/deploy** branch `qa/full-pass-fixes`  
3. Point local `.env` `DATABASE_URL` at Postgres (`docker compose`) so local dev is usable  

### Introduced / residual notes

- Confirmation links **must** include `?t=` token (issued at booking redirect). Old emailed links without token fail unless user is logged in as guest/host.  
- Booking race reduced but not eliminated without DB-level exclusion constraints (**needs decision** if full isolation required).  
- Did not change pricing/billing formulas.  
- Did not run destructive prod commands; did not open PRs unless requested.

### Branch

`qa/full-pass-fixes` — not merged to `main` in this session (review before deploy).

---

*Phases 1–3 complete for in-scope code fixes.*

