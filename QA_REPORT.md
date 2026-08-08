# QA Report — 2026-08-08 production re-loop

**Verdict: PASS** (one P3 robots host fix applied; non-blocking)

**Target:** https://yallcomeback-production.up.railway.app/  
**Branch:** main  
**Deploy:** SUCCESS  

## Gates

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS (0 errors, 4 warnings) |
| `npm run build` | PASS |
| Railway latest deploy | SUCCESS |

## Route matrix (anon)

All critical guest and agent routes returned **200**. Auth surfaces returned **307** to login. Cron without secret returned **401**.

Cherokee host site:

- Home: brand chrome present; **no Explore footer** regression
- About: Contact section + **Send a message**
- Services (signed out): **Details coming soon** + **Host sign in to edit** (editor only when host/admin session)
- Footer: **Send a message** present

Agent layer:

- `/llms.txt` live (72 lines)
- `/api/v1/search?location=Cedar%20Creek&flexible=true&flexibilityDays=3` → ok, count 2, flex 3, windows + priceEstimate
- `/api/v1/listings/{slug}` → nextWindows + bookUrl
- OpenAPI paths: search, listings, availability, openapi.json
- Marketplace listing page: VacationRental JSON-LD present

## Issues

### ROBOTS-1 — Severity: suggestion (fixed)
- **File:** `src/app/robots.ts`
- **Description:** robots.txt was statically prerendered at Docker build with fallback host `yallcomeback.com` while runtime sitemap used the Railway public URL.
- **Fix:** `export const dynamic = "force-dynamic"` + Host as hostname only.

### SVC-EMPTY-1 — Severity: info
- Services page empty content until a host/admin signs in, seeds boat cards, and Saves. Not a defect.

### LINT-W1 — Severity: suggestion
- Four eslint warnings (unused seed var, unused eslint-disable, unused param). Non-blocking.

## Recommendations
1. Set canonical `NEXT_PUBLIC_SITE_URL` on Railway to the public brand domain once DNS is live.
2. Manually QA Services live editor while signed in as platform admin with Cherokee brand selected.
3. Optional: automated e2e smoke of `/api/v1/search` in CI.
