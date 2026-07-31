# Remote open source → Yall Come Back marketplace

This guide is for operators who **run their own MIT open-source deploy** (their
servers, their database) and still want listings to appear on the **central**
Yall Come Back marketplace at [yallcomeback.com](https://yallcomeback.com)
(or your production origin).

Marketplace listing is **optional**. You can self-host forever with zero
marketplace connection.

---

## Two ways to self-host (pick one)

| Path | Where listings live | How marketplace works |
|------|---------------------|------------------------|
| **A. Free self-host on Yall Come Back** | Same database as the platform | Turn on marketplace in **Admin → Brand & website**, publish listings there. Point your domain with `HOST_DOMAIN_MAP` if you want a vanity URL. |
| **B. Remote open source (this doc)** | Your own Postgres + app | Run the code yourself. Create a free host account on the **central** site, generate a **syndication API key**, and `POST` listings to the central API. |

Path A is simpler if you do not need a fully isolated stack.  
Path B is for true independence + optional discovery on the central marketplace.

---

## Prerequisites (path B)

1. A production open-source deploy of this repo (or a fork) on **your** domain.
2. An account on the **central** Yall Come Back platform:
   - Open **[Host a Place](/for-hosts?path=self)** → **Free self-host**
   - Submit the application (marketplace checkbox: your choice)
   - Wait until a platform admin **approves** the host
3. Brand details on the central account: **Admin → Brand & website**
   - Host / brand name, logo, contact
   - **List this brand on the free marketplace** checked if you want discovery
   - Generate a **syndication API key**

---

## Step-by-step: remote → marketplace

### 1. Register and get approved (central site)

```text
https://yallcomeback.com/for-hosts?path=self
```

- Choose **Free self-host** ($0 / month platform fee).
- Optionally check **List on the free Yall Come Back marketplace**.
- Optionally request the **$500 full setup** one-time add-on (separate from hosting).
- After approval you can sign in and open **Admin**.

### 2. Enable marketplace + create an API key

On the **central** site (not your remote admin):

1. Sign in → **Admin → Brand & website**
2. Check **List this brand on the free marketplace** → **Save brand**
3. Under **Open-source / remote syndication** → **Generate syndication API key**
4. **Copy the key immediately** (shown once). Store it as a secret on your remote deploy.

Example secret name:

```env
YCB_MARKETPLACE_ORIGIN=https://yallcomeback.com
YCB_SYNDICATION_KEY=ycb_syn_...
```

### 3. Push a listing from your remote app

`POST` JSON to the **central** origin:

```http
POST {YCB_MARKETPLACE_ORIGIN}/api/syndication/listings
Authorization: Bearer {YCB_SYNDICATION_KEY}
Content-Type: application/json
```

**Minimal body:**

```json
{
  "slug": "lake-cabin",
  "title": "Lake cabin with dock",
  "baseNightlyRate": 175,
  "published": true,
  "listOnMarketplace": true,
  "city": "Malakoff",
  "region": "TX",
  "country": "US",
  "bedrooms": 2,
  "bathrooms": 1,
  "maxGuests": 6,
  "beds": 2,
  "images": [
    {
      "url": "https://your-cdn.example.com/cover.jpg",
      "alt": "Cabin exterior",
      "isCover": true
    }
  ]
}
```

**curl example:**

```bash
export YCB_ORIGIN="https://yallcomeback.com"
export YCB_SYNDICATION_KEY="ycb_syn_...."   # from Brand & website

curl -sS -X POST "$YCB_ORIGIN/api/syndication/listings" \
  -H "Authorization: Bearer $YCB_SYNDICATION_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "lake-cabin",
    "title": "Lake cabin with dock",
    "baseNightlyRate": 175,
    "published": true,
    "listOnMarketplace": true,
    "city": "Malakoff",
    "region": "TX",
    "images": [
      { "url": "https://your-cdn.example.com/cover.jpg", "isCover": true }
    ]
  }'
```

**Success response (shape):**

```json
{
  "ok": true,
  "property": {
    "id": "...",
    "slug": "lake-cabin",
    "title": "Lake cabin with dock",
    "published": true,
    "listOnMarketplace": true,
    "marketplaceUrl": "https://yallcomeback.com/marketplace/properties/lake-cabin?host=your-slug"
  },
  "note": "Listing is live on the marketplace when discovery includes it."
}
```

Open `marketplaceUrl` (or **Find a Place**) to verify.

### 4. Update a listing

Send the same `POST` again with the **same `slug`**. The central host uses
`hostId + slug` as the unique key (upsert).

### 5. List what you have on the central site

```bash
curl -sS "$YCB_ORIGIN/api/syndication/listings" \
  -H "Authorization: Bearer $YCB_SYNDICATION_KEY"
```

### 6. Unpublish or delete

```bash
# Unpublish + remove from marketplace (keeps the row)
curl -sS -X DELETE "$YCB_ORIGIN/api/syndication/listings/lake-cabin" \
  -H "Authorization: Bearer $YCB_SYNDICATION_KEY"

# Hard-delete the central property
curl -sS -X DELETE "$YCB_ORIGIN/api/syndication/listings/lake-cabin" \
  -H "Authorization: Bearer $YCB_SYNDICATION_KEY" \
  -H "Content-Type: application/json" \
  -d '{"delete":true}'
```

---

## Field reference (POST body)

| Field | Required | Notes |
|-------|----------|--------|
| `slug` | **yes** | Unique per host; `a-z`, `0-9`, hyphens |
| `title` | **yes** | Guest-facing name |
| `baseNightlyRate` | **yes** | Non-negative number (USD) |
| `published` | no | Default false if omitted → draft, not browsable |
| `listOnMarketplace` | no | Default true **only if** host marketplace is on; set `false` to keep off marketplace |
| `tagline`, `description` | no | Text |
| `city`, `region`, `country`, `address`, `postalCode` | no | Location |
| `latitude`, `longitude` | no | Map |
| `bedrooms`, `bathrooms`, `maxGuests`, `beds` | no | Capacity |
| `defaultMinNights`, `cleaningFee`, `petFee`, `petsAllowed`, `maxPets`, `depositPercent` | no | Pricing / pets |
| `checkInTime`, `checkOutTime` | no | e.g. `"16:00"` |
| `houseRules` | no | Text |
| `amenities` | no | Array of strings or JSON string |
| `images` | no | `{ url, alt?, isCover? }[]` — use **absolute** image URLs |

---

## When a listing does **not** show on Find a Place

All of these must be true:

1. Host is **approved** and **active** on the central site  
2. Host **List this brand on the free marketplace** is on  
3. Payload has `published: true`  
4. Payload does not set `listOnMarketplace: false`  
5. Host mode is free self-host (`SELF`) **or** paid with active subscription  

If the API returns `ok: true` but `marketplaceUrl` is `null`, read the `note`
field in the response — it explains which flag blocked marketplace visibility.

---

## Security

- Treat `YCB_SYNDICATION_KEY` like a password. Never commit it.
- Rotate anytime: **Admin → Brand & website → Rotate syndication API key** (invalidates the old key).
- The key only allows manage listings for **that host brand**, not other hosts or platform admin.

---

## Path A quick reference (no remote API)

If you do **not** need a separate server:

1. Register free self-host on the central site  
2. Get approved  
3. Manage listings under **Admin → Properties**  
4. Marketplace toggles: brand + each listing  
5. Optional: map `yourdomain.com` with `HOST_DOMAIN_MAP=yourdomain.com:your-slug`  

No syndication key required.

---

## Related product pages

- Host apply: `/for-hosts?path=self`  
- Open source overview: `/open-source`  
- Self-host marketing: `/self-host`  
- Help: `/help/self-host`  
- Brand + API key UI: `/admin/brand`  
