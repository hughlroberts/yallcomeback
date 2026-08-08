# QA State
PHASE: DONE
BRANCH: main
LAST UPDATED: 2026-08-08T04:00:00Z

## NEXT ACTION
Optional: set `NEXT_PUBLIC_SITE_URL=https://yallcomeback.com` (or canonical public host) on Railway so robots + sitemap agree. Sign in as host/admin to exercise Services live editor end-to-end.

## ROUTES (2026-08-08 production re-QA)
| path | auth | status | notes |
| / | anon 200 | pass | Book direct, marketplace, flexible |
| /marketplace | anon 200 | pass | |
| /for-hosts /login /help /about /contact /saved /self-host /open-source | anon 200 | pass | |
| /h/cherokee-landing | anon 200 | pass | Host chrome; no EXPLORE footer |
| /h/cherokee-landing/stays | anon 200 | pass | |
| /h/cherokee-landing/about | anon 200 | pass | Contact + Send a message |
| /h/cherokee-landing/services | anon 200 | pass | Guest: Details coming soon + Host sign in to edit |
| /h/cherokee-landing/contact | anon 200 | pass | → about#contact |
| /llms.txt /agents.md | anon 200 | pass | Agent docs |
| /api/v1/openapi.json | anon 200 | pass | OpenAPI 3.1 |
| /api/v1/search | anon 200 | pass | flexible + ±3 OK |
| /api/v1/listings/{slug} | anon 200 | pass | nextWindows + bookUrl |
| /api/v1/listings/{slug}/availability | anon 200 | pass | |
| /api/marketplace/stays | anon 200 | pass | |
| /robots.txt /sitemap.xml | anon 200 | pass | robots host fixed force-dynamic |
| /.well-known/ai-plugin.json | anon 200 | pass | |
| /admin /ops /account /messages | anon 307 | pass | login required |
| /api/cron/sync-ical | unauth 401 | pass | fail closed |

## FINDINGS
| id | severity | summary | status |
| TENANT-1 … OG-CUSTOM-1 | P1 | Prior QA items | fixed (historical) |
| LINT-1 | P2 | set-state-in-effect | cleared (0 eslint errors this run) |
| LINT-W1 | P3 | 4 eslint warnings (seed unused, eslint-disable noise, host-access unused) | open |
| ROBOTS-1 | P3 | robots.txt prerendered wrong Host vs sitemap | fixed force-dynamic |
| SVC-EMPTY-1 | info | Services empty until host saves blocks | expected |
| TOOL-1 | info | No automated e2e suite | open |

## COMMANDS
typecheck: `npx tsc --noEmit` → PASS
lint: `npm run lint` → 0 errors / 4 warnings
build: `npm run build` → PASS
prod: `https://yallcomeback-production.up.railway.app`
deploy: SUCCESS (cd5cd422… / latest main)

## CREDENTIALS
Local seed only — admin@example.com / admin12345; host@example.com / host12345
