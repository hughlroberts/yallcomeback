# Yall Come Back

**The same stay minus the middle man.**

MIT open-source vacation rentals platform: host-branded sites, optional marketplace, calendars, bookings, and monthly website hosting (optional paid service — not a booking commission).

## Secrets and environment variables

| Where | What |
|-------|------|
| **Local** | Copy `.env.example` → `.env` and fill values. `.env` is gitignored. |
| **GitHub** | Never commit `.env`, API keys, DB passwords, or `AUTH_SECRET`. Only `.env.example` (placeholders) belongs in the repo. |
| **Railway** | Set the same keys under **Project → Variables**. Production values live only in Railway. |

Required for any deploy:

- `DATABASE_URL` — Postgres connection string on Railway (SQLite `file:./dev.db` is local-only)
- `AUTH_SECRET` — long random string (`openssl rand -base64 32`)
- `AUTH_URL` — public site origin, e.g. `https://your-app.up.railway.app`
- `NEXT_PUBLIC_SITE_NAME` — e.g. `Yall Come Back`

Optional: Stripe, Bitcoin, SMS/email messaging (see `.env.example`).

## Quick start

```bash
cd vacation-rentals
npm install
cp .env.example .env   # set AUTH_SECRET at minimum
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Seeded accounts

| Role | Email | Password | Notes |
|------|-------|----------|--------|
| Platform admin | `admin@example.com` | `admin12345` | Approvals & hosting billing |
| Host (live) | `host@example.com` | `host12345` | `/h/cherokee-landing` |
| Host (pending) | `pending@example.com` | `host12345` | Waiting under Admin → Hosting |

## Dual model + optional hosting fee

1. **Host sites** - branded mini-sites at `/h/your-slug` (or custom domain)
2. **Shared marketplace** - **opt-in** listings at `/marketplace` (Find a Place)
3. **Monthly hosting fee** (optional) - if we host the site for you: approve → invoice → go live (per property / month, **not** a % of bookings)
4. **Free self-host** - $0 platform fee; either manage listings on the central app or run a remote open-source deploy

Same calendar, pricing, and bookings either way. Marketplace is never required.

### Remote open source → central marketplace

If you run this repo on **your own servers** and still want stays on the central Yall Come Back marketplace:

1. Apply as free self-host on the **central** site: `/for-hosts?path=self`
2. After approval: **Admin → Brand & website** → enable marketplace → **Generate syndication API key**
3. From your remote deploy, push listings:

```bash
export YCB_ORIGIN="https://yallcomeback.com"
export YCB_SYNDICATION_KEY="ycb_syn_...."

curl -X POST "$YCB_ORIGIN/api/syndication/listings" \
  -H "Authorization: Bearer $YCB_SYNDICATION_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug":"lake-cabin","title":"Lake cabin","baseNightlyRate":175,"published":true,"city":"Malakoff","region":"TX"}'
```

**Full guide (fields, update, unpublish, troubleshooting):**  
[`docs/remote-open-source-marketplace.md`](./docs/remote-open-source-marketplace.md)

Also summarized on the product page: `/open-source#marketplace`

### Public calendars

| URL | What |
|-----|------|
| `/h/[host]/calendar` | All published stays for a host |
| `/h/[host]/properties/[slug]/calendar` | Full month view for one stay |
| `/marketplace/properties/[slug]/calendar` | Same availability via marketplace |

Guests only see available vs unavailable nights - never private block notes.

## Architecture

```
┌─────────────────────┐     opt-in      ┌──────────────────────┐
│  Host site          │ ──────────────► │  Marketplace         │
│  /h/cherokee-landing│                 │  /marketplace        │
│  brand + direct book│                 │  multi-host browse   │
└─────────────────────┘                 └──────────────────────┘
          │                                        │
          └──────── same Property + calendar ──────┘
```

## Features

Feature list is the single source of truth in **`src/lib/features.ts`** (also rendered on `/open-source`). Keep that file updated when you ship something new.

Highlights:

- Host-branded sites, locations, things to do, photo galleries  
- Marketplace search, host directory, destinations  
- Seasonal pricing, deposit %, booking widget  
- Public availability calendars + admin calendar blocks  
- iCal export/import (Airbnb/VRBO style) + cron sync  
- Bookings with soft holds; manual deposit confirm (Stripe optional)  
- Host application, approval, hosting plans & invoices  
- Roles: `ADMIN` | `HOST` | `GUEST`

## Stack

- Next.js (App Router) + TypeScript + Tailwind  
- SQLite via Prisma (swap to Postgres with `DATABASE_URL`)  
- Auth.js credentials  
- License: **MIT** (see `LICENSE`)

## Platform hosting flow (optional paid)

1. Host applies at `/for-hosts`  
2. Builds listings while pending review  
3. Admin → Hosting → approve  
4. Monthly invoice (Stripe or manual)  
5. Paid → public site + marketplace opt-in go live  

## Stripe (placeholder until go-live)

Payments run in **manual mode** until Stripe is configured:

- Guest deposits: Admin → Bookings → mark paid  
- Hosting invoices: Admin → Hosting → mark paid  

At go-live, fill `.env` (never commit secrets):

```env
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Webhook: `POST /api/stripe/webhook`  
Then set `STRIPE_LIVE_READY = true` in `src/lib/features.ts`. Status also shows under **Admin → Settings**.

## iCal sync & scheduled jobs

On each property admin page:

1. Copy **Export URL** into Airbnb/VRBO  
2. Paste their ICS under **Add import source**  
3. **Sync now**, or wait for the automatic schedule

**Automatic (set-and-forget):**

- **In-process** on Railway: `instrumentation.ts` runs iCal sync + booking auto-messages every ~20 minutes in production (`CRON_IN_PROCESS=true`).
- **GitHub Actions backup**: `.github/workflows/cron.yml` pings the same endpoints every 20 minutes (needs secrets `CRON_SECRET` + `CRON_BASE_URL`).

**Manual / external cron:**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.up.railway.app/api/cron/sync-ical
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.up.railway.app/api/cron/booking-messages
```

## License

MIT - free to use, modify, and self-host. See [LICENSE](./LICENSE).
