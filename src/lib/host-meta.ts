import type { MetadataRoute } from "next";
import { publicListingText } from "@/lib/listing-public-text";

/**
 * Meta descriptions for a host's public pages (/h/[slug], /about, /stays).
 * Each page gets its own text so search results don't show the same blurb
 * three times; all stay within ~160 characters.
 */
type HostMetaInput = {
  name: string;
  tagline?: string | null;
  description?: string | null;
};

const MAX = 160;

function clean(s: string | null | undefined): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Cut at a word boundary and add an ellipsis when over `max`. */
export function clampMeta(text: string, max = MAX): string {
  const t = clean(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}

function sentence(s: string): string {
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}

/** Home (/h/[slug]): brand promise + book-direct call to action. */
export function hostHomeDescription(host: HostMetaInput): string {
  const name = clean(host.name);
  const tagline = clean(host.tagline);
  return clampMeta(
    tagline
      ? `${sentence(tagline)} Book direct with ${name}.`
      : `Book direct with ${name}: see stays, prices and open dates.`,
  );
}

/** About (/h/[slug]/about): the host's own story, not the tagline. */
export function hostAboutDescription(host: HostMetaInput): string {
  const name = clean(host.name);
  const about = clean(publicListingText(host.description));
  const text = about
    ? `About ${name}: ${about}`
    : `About ${name}: who we are, where we host, and how to reach us.`;
  const out = clampMeta(text);
  return out === hostHomeDescription(host)
    ? clampMeta(`About ${name}. ${out}`)
    : out;
}

/** Stays (/h/[slug]/stays): the listing index. */
export function hostStaysDescription(host: HostMetaInput): string {
  const name = clean(host.name);
  return clampMeta(
    `All stays from ${name}: photos, nightly prices and open dates. Book direct.`,
  );
}

/** Public pages of one host site: home, stays, and About when it is on. */
export function hostSitemapEntries(
  base: string,
  h: { slug: string; updatedAt: Date; sitePageAbout: boolean },
): MetadataRoute.Sitemap {
  const root = `${base}/h/${encodeURIComponent(h.slug)}`;
  const entries: MetadataRoute.Sitemap = [
    {
      url: root,
      lastModified: h.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${root}/stays`,
      lastModified: h.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
  if (h.sitePageAbout) {
    entries.push({
      url: `${root}/about`,
      lastModified: h.updatedAt,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }
  return entries;
}
