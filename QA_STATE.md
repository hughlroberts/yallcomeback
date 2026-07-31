# QA State
PHASE: DONE
BRANCH: main
LAST UPDATED: 2026-07-31T17:55:00Z

## NEXT ACTION
None required for QA gate. Optional follow-up: clean LINT-1 set-state-in-effect (P2, non-blocking). Fresh agent: read this file; do not re-audit routes marked audited unless code changed.

## ROUTES
| path | auth state tested | status | findings |
| / | anon prod 200 | audited | Discovery rails gated >20 listings |
| /marketplace | anon prod 200 | audited | |
| /marketplace/properties/[slug] | anon API ok | audited | |
| /about | anon (platform) | audited | Custom domain → host about |
| /contact | anon (platform) | audited | Custom domain → host contact |
| /for-hosts | anon prod 200 | audited | Dual-path host story |
| /self-host | anon prod 200 | audited | |
| /open-source | anon prod 200 | audited | |
| /help | anon prod 200 | audited | isPlatformPath |
| /help/[slug] | static | audited | |
| /hosts | anon 307→marketplace | audited | Directory retired |
| /locations | low risk | audited | Content pages |
| /locations/[slug] | low risk | audited | |
| /saved | anon prod 200 | audited | Client-only wishlist |
| /login | anon prod 200 | audited | |
| /register | anon prod 200 | audited | |
| /book/[slug] | code review | audited | |
| /book/confirmation/[id] | token HMAC | audited | Unauth ID alone insufficient |
| /h/[hostSlug] | anon prod 200 | audited | Host chrome + META |
| /h/[hostSlug]/stays | anon prod 200 | audited | |
| /h/[hostSlug]/about | anon prod 200 | audited | |
| /h/[hostSlug]/contact | anon prod 200 | audited | |
| /h/[hostSlug]/properties/[slug] | code | audited | → marketplace booking w/ tenant chrome |
| /h/[hostSlug]/calendar | code | audited | → host stays |
| /h/[hostSlug]/locations/[slug] | code | audited | → host stays |
| /account* | middleware | audited | login required |
| /messages* | signed-out 307; scoped viewer | audited | |
| /admin* | anon 307; scope.ts | audited | |
| /admin/brand | code + gate | audited | Host pick for platform |
| /ops* | anon 307 ADMIN | audited | |
| /api/marketplace/stays | anon JSON | audited | |
| /api/cron/* | unauth 401 | audited | Fail closed |
| /api/ical/* | secret URL | audited | |
| /api/stripe/webhook | signature | audited | |
| /api/auth/* | public | audited | |
| middleware tenant | code + live /h | audited | Spoof strip; forwarded-host |

## FINDINGS
| id | severity | file:line | summary | status | commit |
| TENANT-1 | P1 | middleware.ts | Spoofable x-tenant-slug | fixed | 807322a |
| BRAND-1 | P1 | admin/brand | Silent first-host edit | fixed | 807322a |
| LOGO-1 | P1 | actions/host.ts | Unsafe logoUrl schemes | fixed | 807322a |
| HOST-REDIR-1 | P1 | h calendar/locations | Bounced to YCB marketplace | fixed | 11606fd |
| META-1 | P1 | h/[hostSlug]/layout | Title/OG YCB on host site | fixed | dcd87e5 |
| OG-CUSTOM-1 | P1 | opengraph + custom-domains | Custom domain OG was platform-only | fixed | d99713c |
| LINT-1 | P2 | several client components | 10 set-state-in-effect eslint errors | open | |
| LINT-2 | P2 | seed / eslint-disable | unused vars / directives | open | |
| TOOL-1 | info | package.json | No automated test suite | open | |

## COMMANDS
install: `npm install`
dev server: `npm run dev` (http://localhost:3000)
typecheck: `npx tsc --noEmit` → PASS
lint: `npm run lint` → 10 errors / 4 warnings (P2 only)
test: none configured
build: `npm run build` → PASS (Phase 1)
seed: `npm run db:seed`
prod: `https://yallcomeback-production.up.railway.app`

## CREDENTIALS
Local seed only — admin@example.com / admin12345; host@example.com / host12345; pending@example.com / host12345

## SCRATCH
- Product: host owns customer on custom domain; YCB is stack + marketplace.
- HOST_DOMAIN_MAP example: cherokeelanding.net:cherokee-landing
- QA commits: 807322a, 11606fd, dcd87e5, d99713c
- Live verified: host site header Cherokee Landing; cron 401; ops/admin 307
- Optional next: LINT-1 cleanup; add e2e tests; logo file upload (URL-only today)
