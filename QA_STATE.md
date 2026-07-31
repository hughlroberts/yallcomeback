# QA State
PHASE: LOOP-1
BRANCH: main
LAST UPDATED: 2026-07-31T17:48:00Z

## NEXT ACTION
Optionally reduce open P2 lint set-state-in-effect errors; remaining product polish is host OG on custom domain (not /h path). If no P0/P1 open, mark PHASE DONE after recording final probe.

## ROUTES
| path | auth state tested | status | findings |
| / | anon prod 200 | audited | Discovery rails gated >20 listings |
| /marketplace | anon prod 200 | audited | |
| /marketplace/properties/[slug] | anon API ok | audited | |
| /about | anon (platform) | audited | Custom domain rewrites to host about |
| /contact | anon (platform) | audited | Custom domain rewrites to host contact |
| /for-hosts | anon prod 200 | audited | Dual-path host story |
| /self-host | anon prod 200 | audited | |
| /open-source | anon prod 200 | audited | |
| /help | anon prod 200 | audited | isPlatformPath |
| /help/[slug] | static | audited | |
| /hosts | anon 307→marketplace | audited | Directory retired |
| /locations | pending | pending | Low risk content |
| /locations/[slug] | pending | pending | |
| /saved | anon prod 200 | audited | Client-only wishlist |
| /login | anon prod 200 | audited | |
| /register | anon prod 200 | audited | |
| /book/[slug] | code review | audited | createBooking requires property |
| /book/confirmation/[id] | anon+token | audited | HMAC token; prod fake id 404 |
| /h/[hostSlug] | anon prod 200 | audited | Host chrome live; META-1 fixed |
| /h/[hostSlug]/stays | anon prod 200 | audited | |
| /h/[hostSlug]/about | anon prod 200 | audited | |
| /h/[hostSlug]/contact | anon prod 200 | audited | |
| /h/[hostSlug]/properties/[slug] | code | audited | Redirects marketplace booking w/ host chrome on custom domain |
| /h/[hostSlug]/calendar | code | audited | Now → host stays (not YCB mkt) |
| /h/[hostSlug]/locations/[slug] | code | audited | Now → host stays |
| /account | middleware | audited | login required |
| /account/bookings | middleware | audited | login required |
| /account/settings/* | middleware | audited | login required |
| /messages | signed-out 307 | audited | Gate works |
| /messages/[id] | code | audited | getConversationForViewer scoped |
| /admin | anon 307 | audited | |
| /admin/brand | anon 307; code | audited | TENANT/BRAND fixes committed |
| /admin/properties | layout gate | audited | |
| /admin/properties/[id] | scope.ts | audited | propertyScopeWhere |
| /admin/properties/[id]/setup | scope | audited | |
| /admin/properties/new | resolveHostIdForCreate | audited | |
| /admin/bookings | bookingScopeWhere | audited | |
| /admin/earnings/* | layout | audited | |
| /admin/messages | layout | audited | |
| /admin/guest-messages | layout | audited | |
| /admin/magnets | layout | audited | |
| /admin/settings | host-safe | audited | Redirects ops for platform |
| /ops | anon 307 | audited | ADMIN only |
| /ops/hosting | gate | audited | |
| /ops/hosting/[hostId] | gate | audited | |
| /ops/hosting/plans | gate | audited | |
| /ops/managers | gate | audited | |
| /ops/settings | gate | audited | |
| /api/marketplace/stays | anon JSON | audited | Returns listings |
| /api/cron/booking-messages | no secret 401 | audited | Fail closed |
| /api/cron/sync-ical | no secret 401 | audited | Fail closed (was open historically) |
| /api/ical/[propertyId]/[secret] | secret URL | audited | Prior QA |
| /api/stripe/webhook | stripe sig | audited | Prior QA |
| /api/auth/[...nextauth] | public | audited | |
| middleware HOST_DOMAIN_MAP tenant | code+live /h | audited | TENANT-1 fixed |

## FINDINGS
| id | severity | file:line | summary | status | commit |
| TENANT-1 | P1 | middleware.ts | Client could spoof x-tenant-slug | fixed | 807322a |
| BRAND-1 | P1 | admin/brand | Platform admin could edit first host silently | fixed | 807322a |
| LOGO-1 | P1 | actions/host.ts | logoUrl allowed javascript:/data: | fixed | 807322a |
| HOST-REDIR-1 | P1 | h/.../calendar,locations | Legacy URLs bounced to YCB marketplace | fixed | 11606fd |
| META-1 | P1 | h/[hostSlug] | Document title/OG still YCB on host site | fixed | dcd87e5 |
| OG-CUSTOM-1 | P2 | custom-domains/opengraph | Custom domain still serves platform /opengraph-image (isPlatformPath) | open | |
| LINT-1 | P2 | photo-gallery, save-listing, where-autocomplete, listing-import-agent, etc. | 10 react-hooks/set-state-in-effect errors | open | |
| LINT-2 | P2 | seed / brand-logo | unused vars / unused eslint-disable | open | |
| TOOL-1 | info | package.json | No automated test suite | open | |
| TOOL-2 | info | tooling | tsc PASS; build PASS | fixed | n/a |
| PROD-1 | info | production | Cron unauth 401; ops/admin 307; host site chrome live | fixed | n/a |

## COMMANDS
install: `npm install`
dev server: `npm run dev` (http://localhost:3000)
typecheck: `npx tsc --noEmit` → PASS
lint: `npm run lint` → 10 errors / 4 warnings (P2)
test: none configured
build: `npm run build` → PASS
seed: `npm run db:seed` (Postgres DATABASE_URL)
db setup: `npm run db:setup`
prisma validate: `npx prisma validate`
provision cherokee: `npm run provision:cherokee`
prod base: `https://yallcomeback-production.up.railway.app`

## CREDENTIALS
(local seed only)
| role | email | password | notes |
| platform ADMIN | admin@example.com | admin12345 | |
| HOST | host@example.com | host12345 | Cherokee Landing |
| HOST pending | pending@example.com | host12345 | |
| GUEST | guest@example.com | (sample bookings seed) | |

## SCRATCH
- Direction: host owns customer on custom domain (logo, colors, about, contact); YCB is infrastructure + free marketplace.
- HOST_DOMAIN_MAP=cherokeelanding.net:cherokee-landing,www.cherokeelanding.net:cherokee-landing
- Middleware sets x-tenant-slug + x-tenant-mode (custom|path); strips spoofed headers.
- SiteShell swaps chrome when tenant present.
- Live /h/cherokee-landing: HostSiteHeader with Cherokee Landing; Powered by YCB in footer only.
- DISCOVERY_MIN_LISTINGS=20 hides recently viewed / stay-in / featured until inventory large enough.
- Nav: Find a Place | Host a Place.
- Do not use SQLite file: URLs.
- Never commit .env secrets.
- Commits this QA run: 807322a, 11606fd, dcd87e5 + QA_STATE.md
