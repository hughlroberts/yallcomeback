# Platform pricing intelligence (hosted only)

**Not included in the MIT open-source product.**  
**Not included in normal website hosting fees.**

This is a **paid add-on: $35 / month**, billed as its own line item (never
bundled into plan monthly price). Open-source self-host builds must set
`YCB_OPEN_SOURCE_BUILD=true` (or leave `PLATFORM_PRODUCT_MODE` unset) so routes
and cron stay disabled.

---

## Pricing

| Item | Amount |
|------|--------|
| Website hosting (paid platform) | Per plan (e.g. $/listing/mo) |
| Free self-host | $0 / mo platform fee |
| **Market pricing intelligence add-on** | **+$35 / mo** |

Hosts request the add-on under **Admin → Pricing intelligence**. Ops sets status
to **ACTIVE** after payment (**Ops → Hosting → host**). When active, the next
hosting invoice includes a separate Stripe/manual line for the add-on.

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
- Current `baseNightlyRate`, capacity, city/region

**Peers**

- Other marketplace listings with similar `maxGuests`, prefer same city/region

**External (optional)**

- LLM summary of STR norms by capacity for the area (no direct OTA scrape in v1)

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
