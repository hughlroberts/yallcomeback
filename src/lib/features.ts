/**
 * Product feature inventory - keep this list current when you ship something new.
 * Rendered on /open-source (and mirrored in README) so self-hosters always see
 * what the free copy includes.
 */
export const PRODUCT_NAME = "Yall Come Back";
export const PRODUCT_DOMAIN = "yallcomeback.com";
/** Primary marketing tagline (sentence case). */
export const PRODUCT_TAGLINE = "The same stay minus the middle man";
export const PRODUCT_VERSION = "0.1.0";
export const LICENSE = "MIT";

/**
 * --- Pre-launch placeholders --- 
 * Leave these unset until go-live. Right before launch, ask the owner for:
 *   1. Public git repo URL → set REPO_URL below
 *   2. Stripe account keys → set env vars (never commit secrets); flip STRIPE_ENABLED=true
 */

/**
 * Public git clone URL for self-hosters.
 * Leave null until go-live - then set e.g. "https://github.com/you/yallcomeback".
 */
export const REPO_URL: string | null = null;

/**
 * Stripe is off by default (manual deposits + manual hosting invoices).
 * Keys live only in `.env` - not in this file. Set STRIPE_LIVE_READY to true
 * after env is filled and webhook is verified; use as a go-live checklist flag.
 */
export const STRIPE_LIVE_READY = false;

/** Human-readable status for admin / docs */
export function stripeSetupLabel(envEnabled: boolean, hasSecret: boolean) {
  if (STRIPE_LIVE_READY && envEnabled && hasSecret) return "Live";
  if (envEnabled && hasSecret) return "Env keys set (mark STRIPE_LIVE_READY when verified)";
  if (envEnabled) return "Enabled but missing secret key";
  return "Placeholder - manual payments until go-live";
}

export type FeatureGroup = {
  category: string;
  summary: string;
  items: string[];
};

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    category: "Host-branded websites",
    summary: "Each host gets their own public site under /h/[slug].",
    items: [
      "Branded home page with logo, colors, tagline, and about copy",
      "Property listing cards with real photo covers",
      "Property detail pages with multi-image galleries",
      "Location pages with area description and things to do",
      "Public availability calendar in the listing reserve card",
      "Direct booking from the host site (channel: host_site)",
    ],
  },
  {
    category: "Shared marketplace",
    summary: "Optional multi-host discovery - hosts and listings opt in.",
    items: [
      "Marketplace browse + search (place, city, host, guests)",
      "Marketplace property detail with host attribution",
      "Listing bottom: Meet your host + Things to know (Airbnb-style)",
      "Share listing + heart/save stays (device wishlist at /saved)",
      "Guest continuity: continue last search, recently viewed, based on your search",
      "Host directory and destination/location directory",
      "Same inventory and calendar as the host site",
      "Bookings tagged as marketplace vs host site",
    ],
  },
  {
    category: "Listings & content",
    summary: "Everything guests need to picture the stay.",
    items: [
      "Photos with cover + sort order",
      "Amenities (JSON list), house rules, check-in/out times",
      "Cancellation policies (Flexible → Super firm) + full help center",
      "Bedrooms, baths, beds, max guests",
      "City, region, country, optional coordinates",
      "Listing map (“Where you’ll be”) with privacy-aware pin",
      "Publish / unpublish and featured flags",
      "Per-property marketplace visibility toggle",
    ],
  },
  {
    category: "Pricing & seasons",
    summary: "Base rates plus seasonal peaks without a booking commission.",
    items: [
      "Base nightly rate and cleaning fee",
      "Pet fee per stay or per pet; max dogs/pets per listing",
      "Deposit percent for hold payments",
      "Seasonal price windows with per-season min nights",
      "Quote engine in the booking widget",
      "Host-level taxes only (help article; host must file; platform not liable)",
      "Host disclaimer language (property or host default) accepted at booking",
    ],
  },
  {
    category: "Messaging",
    summary: "Guest ↔ host communication in-app; SMS hooks for hosted portal.",
    items: [
      "In-app conversations from property pages and after booking",
      "Host earnings: Performance, Upcoming, Paid, Reports (Airbnb-style)",
      "Host inbox under Admin → Messages",
      "Per-listing auto messages: on booking, 1 day before, optional 6 hours before",
      "Copy booking message templates to all listings (opt-in)",
      "SMS/email dispatch hooks (env-gated; dry-run by default)",
      "Self-host keeps hooks but does not send SMS out of the box",
    ],
  },
  {
    category: "Calendar & availability",
    summary: "One calendar for direct, marketplace, and external channels.",
    items: [
      "Public availability on the listing reserve calendar (available / unavailable)",
      "Manual blocks with type, occupant name, private notes",
      "Booking holds block the calendar automatically",
      "Guest-safe API: no private notes exposed publicly",
      "iCal export URL per listing (Airbnb/VRBO import)",
      "iCal import sources + sync-now + cron endpoint",
    ],
  },
  {
    category: "Bookings & guests",
    summary:
      "Request → deposit → confirm (USD cash/card, or Bitcoin when enabled).",
    items: [
      "Guest booking request with dates, guests, notes",
      "Pending payment / confirmed / cancelled / completed statuses",
      "Deposit amounts in US dollars",
      "Bitcoin deposit option (env address + BIP21 wallet link)",
      "Manual / Bitcoin deposit mark-paid in admin (with tx id)",
      "Guest account bookings list",
      "Soft calendar hold while pending",
    ],
  },
  {
    category: "Platform website hosting & billing",
    summary: "Monthly hosting fee per property - not a cut of bookings.",
    items: [
      "Host application form with plan selection",
      "Approval workflow (pending / approved / rejected / suspended)",
      "PLATFORM vs SELF hosting modes",
      "Optional marketplace for paid and free self-host",
      "Remote open-source → marketplace syndication API (Bearer key)",
      "Hosting plans: per-property or flat monthly",
      "Hosting invoices (Stripe invoice when configured, else manual)",
      "Subscription statuses: none, pending payment, active, past due, cancelled",
      "Optional $500 one-time full setup (listings, brand, custom website)",
      "Public site only live when approved + paid (or free self-host)",
    ],
  },
  {
    category: "Admin portals",
    summary: "Platform operators and hosts manage their own scopes.",
    items: [
      "Roles: ADMIN, HOST, GUEST (Auth.js credentials)",
      "Host-scoped property, booking, and location admin",
      "Platform admin: all hosts, hosting approvals, plans, settings",
      "Property editor: photos, seasons, blocks, iCal, amenities",
    ],
  },
  {
    category: "Account settings",
    summary: "Airbnb-style profile hub for guests and hosts.",
    items: [
      "Personal information (name, phone, addresses, emergency contact)",
      "Login & security (password change)",
      "Privacy toggles (read receipts, search engines)",
      "Message alerts (email / SMS preferences under Messages)",
      "Taxes (host config link + liability warning)",
      "Payments as links only (Stripe, Bitcoin, hosting invoices, bookings)",
      "Languages & currency (USD / miles defaults)",
    ],
  },
  {
    category: "Stack & ops",
    summary: "Modern app you can run locally or on a small VPS.",
    items: [
      "Next.js App Router + TypeScript + Tailwind",
      "Prisma + SQLite by default (Postgres-ready via DATABASE_URL)",
      "Docker Compose starter",
      "Seed data with demo hosts and real-style listings",
      "Open source under MIT - free to self-host and reuse",
    ],
  },
];

/**
 * Guest-facing self-host steps - website hosting language only.
 *
 * PUBLISH REMINDER (later stage): keep /self-host and help “Free self-host”
 * oriented to domain + website hosting for resort operators. Do not put
 * Postgres, npm, Docker, or env-var ops on that path. Technical install
 * details stay on /open-source (developer path). Self-host website deploy
 * may become its own hosting stack separate from the Yall Come Back platform app.
 */
/** Host-facing self-host steps. Write in ASD-STE100 (see docs/help-writing-ste.md). */
export const SELF_HOST_STEPS = [
  {
    title: "Choose website hosting",
    body: "Choose hosting that can run a full website on your domain. You can use your current host, a managed website host, or a VPS with support. If you do not want to manage hosting, use Yall Come Back paid platform hosting instead.",
  },
  {
    title: "Point your domain",
    body: "Use the same domain that guests already know. Update DNS with A or CNAME records so the domain points to the new site.",
  },
  {
    title: "Install Yall Come Back for websites",
    body: REPO_URL
      ? `Install the free Yall Come Back website package from the open-source project (${REPO_URL}). You can also ask your web person or host support to install it. You get the same booking and listing tools as the platform.`
      : "Install the free Yall Come Back website package (download link at launch). You can also ask your web person or host support to install it. You get the same booking and listing tools as the platform.",
  },
  {
    title: "Add your brand and stays",
    body: "Upload your logo and photos. Write your about text. Set nightly rates, seasons, house rules, and calendars.",
  },
  {
    title: "Publish and welcome guests",
    body: "Publish your listings. Guests book on your website. Optionally list the same stays on the free Yall Come Back marketplace (your choice).",
  },
];

/** Developer-oriented install (open-source page only - not guest marketing). */
export const SELF_HOST_DEV_STEPS = [
  {
    title: "Copy the project",
    body: REPO_URL
      ? `Clone the open-source repo (${REPO_URL}). Everything on the live platform is in that codebase.`
      : "Clone or download the open-source repository (public git URL will be linked here at launch). Everything you see on the platform is in that codebase.",
  },
  {
    title: "Install & seed",
    body: "Run npm install, then npm run db:setup to create the database and demo data.",
  },
  {
    title: "Configure env",
    body: STRIPE_LIVE_READY
      ? "Copy .env.example → .env. Set AUTH_SECRET, DATABASE_URL, and Stripe keys (STRIPE_ENABLED=true)."
      : "Copy .env.example → .env. Set AUTH_SECRET and DATABASE_URL. Leave Stripe off (STRIPE_ENABLED=false) until go-live - manual deposits and hosting invoices work without it.",
  },
  {
    title: "Run or deploy",
    body: "npm run dev for local. For production: npm run build && npm start, or docker compose up.",
  },
  {
    title: "Brand it as yours",
    body: "Change site name, seed your host, add properties, connect iCal, and point your domain at the site.",
  },
];
