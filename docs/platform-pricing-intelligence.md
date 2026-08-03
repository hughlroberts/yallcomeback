# Platform pricing intelligence (hosted only · secret rollout)

**Not in open source.**  
**Not in website hosting fees.**  
**Not advertised publicly.** Admin-only; rolled out host-by-host.

This is a **paid add-on: $35 / month**, billed as its own invoice line.

---

## Rollout (ops)

| Step | Where | What |
|------|--------|------|
| 1. Beta access | Ops → Hosting → host | Check **Beta access on** → shows nav for that host only |
| 2. Collect payment | Your process | $35/mo separate from hosting |
| 3. Mark paid | Same ops form | Paid add-on status → **Active** |
| 4. Host uses tool | Admin → Pricing intelligence | Run research → approve → apply |

**Your testing:** as platform ADMIN you always see the nav. On the pricing page,
check **Bypass access / payment** to run research without charging yourself.

**Hosts without beta access:** no nav item; `/admin/pricing` redirects away.

---

## Pricing

| Item | Amount |
|------|--------|
| Website hosting (paid platform) | Per plan |
| Free self-host | $0 / mo platform fee |
| **Market pricing intelligence add-on** | **+$35 / mo** (separate line) |

When add-on is ACTIVE, hosting invoices add a separate Stripe/manual line.

---

## What it does

Once a month (or on demand), multi-step research produces **price suggestions**
for each published listing:

| Agent | Role |
|-------|------|
| **Collector** | Internal bookings/occupancy + marketplace peers matched by **guest capacity** (`maxGuests` ±1). Optional LLM market brief if `XAI_API_KEY` is set. |
| **Analyst** | Capacity-anchored rate targets, occupancy/season overlays, ±15% guardrails, do-nothing under 3%. |
| **Recommender** | Markdown report + ranked suggestions with experiment design and risk notes. |
| **Executor** | Only after **Approve** then **Apply** — updates `baseNightlyRate`. |

Primary matching key is **house size / sleeps N**, unless occupancy or seasonality
is explicitly stronger in the rationale.

---

## Enable (hosted Railway / main product)

```env
PLATFORM_PRODUCT_MODE=true
# Optional override / local test:
# PRICING_INTELLIGENCE_ENABLED=true

# Optional richer external brief (xAI Grok or OpenAI-compatible):
# XAI_API_KEY=...
# PRICING_INTELLIGENCE_MODEL=grok-4-1-fast-non-reasoning

CRON_SECRET=...   # required for HTTP cron
```

Open-source / pure self-host:

```env
YCB_OPEN_SOURCE_BUILD=true
# or simply omit PLATFORM_PRODUCT_MODE
```

---

## Host UI

**Admin → Pricing intelligence**

1. **Request add-on** ($35/mo) if not already ACTIVE.
2. After ops activates: **Start research run**.
3. Open the run → read report + per-listing cards.
4. **Approve** / **Reject** each suggestion.
5. **Apply to listing base rate** only for approved items.

Without an active add-on, research runs are blocked (platform can bypass for support only).

---

## Monthly schedule

Hit once a month (GitHub Actions, Railway cron, etc.):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://yallcomeback.com/api/cron/pricing-intelligence
```

Skips hosts that already completed a run in the last 28 days.

Optional (usually leave off):

```env
PRICING_INTELLIGENCE_MONTHLY_IN_PROCESS=true
```

That would attempt monthly logic inside the 20‑minute in-process cron (still
idempotent via the 28-day window). Prefer an external monthly job.

---

## Data sources (v1)

**Internal**

- Bookings in lookback window (default 90 days)
- Confirmed nights / rough occupancy
- Current `baseNightlyRate`, capacity, amenities, coords, title/description

**Peers (balanced — not capacity-only)**

Sources (never guest-facing proxies):

1. **`PricingMarketComp`** — private table only for the pricing agents. Not a
   `Property`, not on marketplace, not bookable, not linked from any guest UI.
2. **Real marketplace listings** from other approved hosts (optional fill-in).

Matching:

- Similar `maxGuests`, **plus** location tier:
  - `waterfront_prime` (waterfront / beach / private dock)
  - `water_access` (lake/beach access, row-back demotion)
  - `water_view`
  - `inland`
- Pool / dock mismatch heavily penalized (lake+pool ≠ lake-only)
- Distance miles when lat/lng present (same block vs 1–2 mi away)
- “Fair” vs “soft” comps; soft set only if fair set is thin

Seed / maintain private comps: `scripts/migrate-pricing-comps-private.ts`
(or upsert into `PricingMarketComp` directly).

**HITL feedback (improves later runs)**

- On approve / reject / apply: tags + free-text notes
- Tags like `location_mismatch`, `amenity_mismatch`, `wrong_comps` tighten next cycle
- Prior feedback stored on each recommendation row

**External (optional)**

- LLM brief that must respect location quality (no direct OTA scrape in v1)

---

## Explicitly out of open source

| Surface | Open source | Hosted platform |
|---------|-------------|-----------------|
| Admin → Pricing intelligence | Hidden / disabled | Available |
| `/api/cron/pricing-intelligence` | 404 | Auth’d monthly run |
| Apply rate from recommendation | N/A | Human-gated |

Do **not** list this feature in `FEATURE_GROUPS` (the open-source inventory).
Use `PLATFORM_ONLY_FEATURE_LABELS` in `src/lib/platform-features.ts` instead.

---

## Future extensions

- True OTA browse/scrape with legal review and cost caps  
- A/B experiment tracking on quotes  
- Seasonal rate table proposals (not only base rate)  
- Slack/email digest of pending approvals  
