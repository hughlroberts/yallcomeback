# QA State
PHASE: 2
BRANCH: main
LAST UPDATED: 2026-07-31T17:50:00Z

## NEXT ACTION
Static-audit middleware tenant isolation + host site pages + admin/brand; record findings; fix P0/P1 as found (one commit per fix).

## ROUTES
| path | auth state tested | status | findings |
| / | anon | pending | Phase2 static next |
| /marketplace | anon | pending | |
| /marketplace/properties/[slug] | anon | pending | |
| /about | anon | pending | platform only on YCB |
| /contact | anon | pending | platform only on YCB |
| /for-hosts | anon | pending | |
| /self-host | anon | pending | |
| /open-source | anon | pending | |
| /help | anon | pending | |
| /help/[slug] | anon | pending | |
| /hosts | anon | pending | |
| /locations | anon | pending | |
| /locations/[slug] | anon | pending | |
| /saved | anon | pending | |
| /login | anon | pending | |
| /register | anon | pending | |
| /book/[slug] | anon | pending | |
| /book/confirmation/[id] | anon+token | pending | |
| /h/[hostSlug] | anon (tenant) | pending | white-label focus |
| /h/[hostSlug]/stays | anon (tenant) | pending | |
| /h/[hostSlug]/about | anon (tenant) | pending | |
| /h/[hostSlug]/contact | anon (tenant) | pending | |
| /h/[hostSlug]/properties/[slug] | anon (tenant) | pending | |
| /h/[hostSlug]/calendar | anon | pending | |
| /h/[hostSlug]/locations/[slug] | anon | pending | |
| /account | guest | pending | |
| /account/bookings | guest | pending | |
| /account/settings/* | guest/host | pending | |
| /messages | guest signed-in | pending | |
| /messages/[id] | guest signed-in | pending | |
| /admin | host/admin | pending | |
| /admin/brand | host/admin | pending | new |
| /admin/properties | host/admin | pending | |
| /admin/properties/[id] | host/admin | pending | |
| /admin/properties/[id]/setup | host/admin | pending | |
| /admin/properties/new | host/admin | pending | |
| /admin/bookings | host/admin | pending | |
| /admin/earnings/* | host/admin | pending | |
| /admin/messages | host/admin | pending | |
| /admin/guest-messages | host/admin | pending | |
| /admin/magnets | host/admin | pending | |
| /admin/settings | host/admin | pending | |
| /ops | admin | pending | |
| /ops/hosting | admin | pending | |
| /ops/hosting/[hostId] | admin | pending | |
| /ops/hosting/plans | admin | pending | |
| /ops/managers | admin | pending | |
| /ops/settings | admin | pending | |
| /api/marketplace/stays | anon | pending | |
| /api/cron/booking-messages | cron secret | pending | |
| /api/cron/sync-ical | cron secret | pending | |
| /api/ical/[propertyId]/[secret] | secret | pending | |
| /api/stripe/webhook | stripe sig | pending | |
| /api/auth/[...nextauth] | public | pending | |
| middleware HOST_DOMAIN_MAP tenant | custom domain | pending | |

## FINDINGS
| id | severity | file:line | summary | status | commit |
| LINT-1 | P2 | multiple client components | 10 eslint set-state-in-effect errors (photo-gallery, save-listing, where-autocomplete, etc.) | open | |
| TOOL-1 | info | package.json | No npm test script / no automated suite | open | |
| TOOL-2 | info | tooling | tsc PASS; build PASS (2026-07-31) | fixed | n/a |

## COMMANDS
install: `npm install`
dev server: `npm run dev` (http://localhost:3000)
typecheck: `npx tsc --noEmit` → PASS 2026-07-31
lint: `npm run lint` → 10 errors / 4 warnings (exit code 0 from npm; still dirty)
test: `npm test` (no script — none configured)
build: `npm run build` → PASS 2026-07-31
seed: `npm run db:seed` (requires Postgres DATABASE_URL)
db setup: `npm run db:setup`
prisma validate: `npx prisma validate`
provision cherokee: `npm run provision:cherokee`

## CREDENTIALS
(from seed / README — local only)
| role | email | password | notes |
| platform ADMIN | admin@example.com | admin12345 | Approvals & ops |
| HOST (live) | host@example.com | host12345 | Cherokee Landing brand |
| HOST (pending) | pending@example.com | host12345 | Waiting approval |
| GUEST | guest@example.com | (seed-sample-bookings) | If sample bookings seeded |

Production: do not use seed passwords; use real Railway accounts.

## SCRATCH
- Product direction: dual-brand YCB marketplace vs host-owned white-label sites (logo, colors, about, contact). Host owns customer on custom domain.
- Recent commits: host white-label (443de6a), Find/Host a Place nav, discovery rails gated until >20 listings, brand wordmark, seal header.
- HOST_DOMAIN_MAP e.g. `cherokeelanding.net:cherokee-landing,www.cherokeelanding.net:cherokee-landing`
- Prisma provider is **postgresql only** — SQLite `file:` URLs fail at runtime.
- Local DB may be unavailable; prefer static analysis + tsc/lint/build when DB down.
- Prior QA_REPORT.md (2026-07-30) exists — use for historical P0/P1 context; this QA_STATE is the live resumable tracker.
- Middleware: `x-tenant-slug` + `x-tenant-mode` (custom|path). Admin on custom domain must NOT get host chrome (platform paths skip tenant header).
- Tenant chrome: SiteShell swaps SiteHeader/Footer for HostSiteHeader/Footer.
- No automated test suite.
- Never commit .env secrets.
