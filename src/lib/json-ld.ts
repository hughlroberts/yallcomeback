/**
 * Schema.org JSON-LD builders. Only real data: no ratings, no reviews,
 * no invented fields. Empty values are left out.
 */
import { BRANDED_WEBSITE_USD, MARKETPLACE_LISTING_USD } from "@/lib/hosting-prices";
import type { HelpArticle } from "@/lib/help";

type Json = Record<string, unknown>;

/** Serialize for a <script type="application/ld+json"> body (no `</script>` break-out). */
export function jsonLdScriptBody(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function clean<T extends Json>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
    ),
  ) as T;
}

function absolute(origin: string, url: string | null | undefined): string | undefined {
  const u = url?.trim();
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u)) return u;
  return `${origin.replace(/\/$/, "")}${u.startsWith("/") ? u : `/${u}`}`;
}

/** /for-hosts: the hosting service Yall Come Back sells, with published prices. */
export function forHostsServiceJsonLd(opts: { origin: string; url: string; description: string }): Json {
  const org = { "@type": "Organization", name: "Yall Come Back", url: `${opts.origin.replace(/\/$/, "")}/` };
  const monthly = (price: number, unitText: string) => ({
    "@type": "UnitPriceSpecification",
    price,
    priceCurrency: "USD",
    unitText,
    billingDuration: "P1M",
  });
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Vacation rental direct booking hosting",
    serviceType: "Vacation rental direct booking software and hosting",
    description: opts.description,
    url: opts.url,
    provider: org,
    brand: org,
    areaServed: { "@type": "Country", name: "US" },
    offers: [
      {
        "@type": "Offer",
        name: "Marketplace listing",
        description: `$${MARKETPLACE_LISTING_USD} per published listing per month. Not a booking commission.`,
        price: MARKETPLACE_LISTING_USD,
        priceCurrency: "USD",
        priceSpecification: monthly(MARKETPLACE_LISTING_USD, "listing per month"),
        url: opts.url,
      },
      {
        "@type": "Offer",
        name: "Branded website",
        description: `$${BRANDED_WEBSITE_USD} per month for the whole website, any number of listings. Marketplace listing included. Not a booking commission.`,
        price: BRANDED_WEBSITE_USD,
        priceCurrency: "USD",
        priceSpecification: monthly(BRANDED_WEBSITE_USD, "month"),
        url: opts.url,
      },
      {
        "@type": "Offer",
        name: "Self-host",
        description: "Run the open-source software yourself. $0 platform fee.",
        price: 0,
        priceCurrency: "USD",
        url: opts.url,
      },
    ],
  };
}

/** /help: FAQPage from the help center articles shown on the page. */
export function helpFaqJsonLd(opts: {
  articles: Pick<HelpArticle, "slug" | "title" | "body">[];
  urlFor: (slug: string) => string;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: opts.articles.map((a) => ({
      "@type": "Question",
      name: a.title,
      url: opts.urlFor(a.slug),
      acceptedAnswer: { "@type": "Answer", text: a.body, url: opts.urlFor(a.slug) },
    })),
  };
}

/** /h/*: the host brand as an Organization, from its public profile only. */
export function hostOrganizationJsonLd(opts: {
  origin: string;
  url: string;
  host: {
    name: string;
    tagline?: string | null;
    description?: string | null;
    logoUrl?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    siteAddress?: string | null;
    websiteUrl?: string | null;
  };
  sameAs?: string[];
}): Json {
  const { host } = opts;
  const sameAs = [...(opts.sameAs || [])];
  const site = absolute(opts.origin, host.websiteUrl);
  if (site && site !== opts.url) sameAs.push(site);
  return clean({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: host.name,
    url: opts.url,
    slogan: host.tagline?.trim() || undefined,
    description: host.description?.trim() || undefined,
    logo: absolute(opts.origin, host.logoUrl),
    email: host.contactEmail?.trim() || undefined,
    telephone: host.contactPhone?.trim() || undefined,
    address: host.siteAddress?.trim() || undefined,
    sameAs,
  });
}

/** The platform itself, Yall Come Back, as an Organization. */
export function platformOrganizationJsonLd(origin: string): Json {
  const base = origin.replace(/\/$/, "");
  return {
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: "Yall Come Back",
    url: `${base}/`,
    logo: `${base}/apple-touch-icon.png`,
  };
}

export type WebPageKind = "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage";

/**
 * Public content pages: one @graph with the WebPage (title and description
 * as shown in the page metadata), the platform Organization as publisher,
 * and a breadcrumb trail when the page sits under a parent (e.g. /help/x).
 */
export function webPageJsonLd(opts: {
  origin: string;
  path: string;
  name: string;
  description: string;
  kind?: WebPageKind;
  breadcrumbs?: { name: string; path: string }[];
}): Json {
  const base = opts.origin.replace(/\/$/, "");
  const url = absolute(base, opts.path) ?? `${base}/`;
  const org = platformOrganizationJsonLd(base);
  const crumbs = opts.breadcrumbs ?? [];
  const page = clean({
    "@type": opts.kind ?? "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: opts.name,
    description: opts.description.trim() || undefined,
    inLanguage: "en-US",
    isPartOf: { "@type": "WebSite", name: "Yall Come Back", url: `${base}/` },
    publisher: { "@id": org["@id"] },
    breadcrumb: crumbs.length ? { "@id": `${url}#breadcrumb` } : undefined,
  });
  const graph: Json[] = [page, org];
  if (crumbs.length) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: absolute(base, c.path),
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
