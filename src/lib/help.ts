/**
 * Yall Come Back Help Center catalog.
 * Paths are under /help/[slug].
 * All guest-facing titles, blurbs, and descriptions use ASD-STE100 Simplified Technical English.
 * See docs/help-writing-ste.md and AGENTS.md.
 */

export type HelpCategoryId =
  | "getting-started"
  | "guests"
  | "hosts"
  | "policies";

export type HelpArticle = {
  slug: string;
  /** Breadcrumb / card category label */
  category: string;
  categoryId: HelpCategoryId;
  title: string;
  /** Short blurb for the help index */
  body: string;
  /** Meta description */
  description: string;
  /** Related article slugs (shown at bottom) */
  related?: string[];
};

export const HELP_CATEGORIES: {
  id: HelpCategoryId;
  title: string;
  description: string;
}[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Learn how Yall Come Back works for guests and hosts.",
  },
  {
    id: "guests",
    title: "For guests",
    description: "Search, book, pay, send messages, and manage trips.",
  },
  {
    id: "hosts",
    title: "For hosts",
    description: "Manage listings, calendars, prices, messages, and earnings.",
  },
  {
    id: "policies",
    title: "Policies",
    description: "Community rules that apply to homes on Yall Come Back.",
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "getting-started",
    category: "Getting started",
    categoryId: "getting-started",
    title: "Getting started on Yall Come Back",
    body: "Create an account. Browse stays. Learn the next steps for guests and hosts.",
    description:
      "Start on Yall Come Back. Create an account. Browse stays. Book or open host Admin.",
    related: ["how-yall-come-back-works", "search-and-book", "become-a-host"],
  },
  {
    slug: "how-yall-come-back-works",
    category: "Getting started",
    categoryId: "getting-started",
    title: "How Yall Come Back works",
    body: "Hosts own the guest. The marketplace is optional discovery. Bookings go to the host.",
    description:
      "Yall Come Back model: host-branded websites, optional marketplace, and direct booking without a cut of each stay.",
    related: [
      "getting-started",
      "become-a-host",
      "branded-website",
      "search-and-book",
    ],
  },
  {
    slug: "search-and-book",
    category: "Guest guide",
    categoryId: "guests",
    title: "Search and book a stay",
    body: "Browse the marketplace. Check dates. Request a booking. Confirm the stay.",
    description:
      "How guests find homes, request bookings, and complete a reservation on Yall Come Back.",
    related: ["payments", "messaging", "cancellation-policies", "saved-stays"],
  },
  {
    slug: "payments",
    category: "Guest guide",
    categoryId: "guests",
    title: "Payments and deposits",
    body: "Learn about deposits, stay balances, USD, Bitcoin, and paid status.",
    description:
      "How deposits and payments work on Yall Come Back for guests and hosts.",
    related: ["search-and-book", "earnings", "cancellation-policies"],
  },
  {
    slug: "messaging",
    category: "Guest guide",
    categoryId: "guests",
    title: "Messaging your host",
    body: "Send messages in the app before and after you book. Keep talk on Yall Come Back.",
    description:
      "How guest and host messaging works on Yall Come Back, including the inbox and booking threads.",
    related: ["search-and-book", "host-messages", "account"],
  },
  {
    slug: "saved-stays",
    category: "Guest guide",
    categoryId: "guests",
    title: "Save stays you like",
    body: "Save listings with the heart control. Open Wishlists on this device.",
    description:
      "How to save listings (Wishlists) and when continue-search rails appear on Yall Come Back.",
    related: ["search-and-book", "account"],
  },
  {
    slug: "account",
    category: "Guest guide",
    categoryId: "guests",
    title: "Your account and settings",
    body: "Manage profile, login security, privacy, messages, and trip bookings.",
    description:
      "Manage your Yall Come Back account: personal data, security, messages, and trips.",
    related: ["search-and-book", "payments", "messaging"],
  },
  {
    slug: "become-a-host",
    category: "Host guide",
    categoryId: "hosts",
    title: "Become a host",
    body: "Apply for paid platform hosting or free self-host. Get approval. Go online.",
    description:
      "How to host on Yall Come Back: platform hosting, self-host, plans, and approval.",
    related: [
      "listings",
      "branded-website",
      "self-host",
      "how-yall-come-back-works",
      "pricing",
    ],
  },
  {
    slug: "branded-website",
    category: "Host guide",
    categoryId: "hosts",
    title: "Branded website on your domain",
    body: "Keep your brand on your domain. Yall Come Back hosts the site. Listings can also show on the marketplace.",
    description:
      "How platform hosting puts your brand on your domain with Yall Come Back infrastructure, marketplace listings, and DNS steps.",
    related: [
      "how-yall-come-back-works",
      "become-a-host",
      "listings",
      "self-host",
    ],
  },
  {
    slug: "listings",
    category: "Host guide",
    categoryId: "hosts",
    title: "Create and manage listings",
    body: "Add photos, amenities, house rules, publish status, marketplace options, and fridge magnets.",
    description:
      "How hosts set up listings on Yall Come Back for their website and the marketplace.",
    related: [
      "branded-website",
      "calendar",
      "pricing",
      "cancellation-policies",
      "host-messages",
    ],
  },
  {
    slug: "calendar",
    category: "Host guide",
    categoryId: "hosts",
    title: "Calendar and availability",
    body: "Block dates. Manage booking holds. Use public calendars and iCal sync.",
    description:
      "Manage availability, manual blocks, and calendar sync for Yall Come Back listings.",
    related: ["listings", "search-and-book", "pricing"],
  },
  {
    slug: "pricing",
    category: "Host guide",
    categoryId: "hosts",
    title: "Pricing and seasons",
    body: "Set nightly rates, fees, deposits, seasonal dates, and booking quotes.",
    description:
      "How Yall Come Back hosts set base rates, seasons, fees, and deposit percent.",
    related: ["taxes", "listings", "payments", "earnings"],
  },
  {
    slug: "taxes",
    category: "Host guide",
    categoryId: "hosts",
    title: "Taxes for hosts",
    body: "Taxes are host-level only. You file and pay. The platform is not liable.",
    description:
      "How host-level taxes work on Yall Come Back. You file and remit. The platform does not.",
    related: ["pricing", "payments", "account", "cancellation-policies"],
  },
  {
    slug: "host-messages",
    category: "Host guide",
    categoryId: "hosts",
    title: "Booking auto messages",
    body: "Set host defaults for on booking, 1 week before, and 1 day before check-in.",
    description:
      "Set automatic guest messages for bookings on each Yall Come Back listing.",
    related: ["messaging", "listings", "cancellation-policies"],
  },
  {
    slug: "earnings",
    category: "Host guide",
    categoryId: "hosts",
    title: "Host earnings",
    body: "Review performance, upcoming money, paid history, reports, and CSV export.",
    description:
      "How the Yall Come Back host earnings area tracks deposits, balances, and performance.",
    related: ["payments", "pricing", "become-a-host"],
  },
  {
    slug: "self-host",
    category: "Host guide",
    categoryId: "hosts",
    title: "Free self-host website",
    body: "Run Yall Come Back on your domain. Optionally list on the free marketplace. Keep your brand.",
    description:
      "Host Yall Come Back free under MIT. Optional marketplace via central account or remote syndication API.",
    related: [
      "become-a-host",
      "branded-website",
      "how-yall-come-back-works",
      "listings",
    ],
  },
  {
    slug: "cancellation-policies",
    category: "Community policy · Home host",
    categoryId: "policies",
    title: "Cancellation policies for your home",
    body: "Set short-stay and monthly policies. Learn the 24-hour free window and overrides.",
    description:
      "Choose short-stay and monthly cancellation policies. Full refund rules for hosts and guests.",
    related: ["listings", "search-and-book", "host-messages", "payments"],
  },
];

export function helpPath(slug: string): string {
  return `/help/${slug}`;
}

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function articlesInCategory(categoryId: HelpCategoryId): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.categoryId === categoryId);
}

/** Permalink used across listing UI and footer */
export const HELP_CANCELLATION_POLICIES_PATH = helpPath(
  "cancellation-policies"
);
