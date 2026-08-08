import type { Host, HostSitePublishState } from "@prisma/client";

/**
 * Hosted websites are NOT a freeform CMS.
 * Hosts only choose palette, logos, and which fixed pages are on:
 *   1. Booking (always on — home + stays)
 *   2. About (optional — includes phone, address, contact)
 *   3. Other services (optional — boats, tours, etc.)
 * Plus outbound social links (Facebook, X, Instagram, TikTok).
 */

export type HostSiteConfig = Pick<
  Host,
  | "sitePageAbout"
  | "sitePageServices"
  | "siteServicesTitle"
  | "siteServicesBody"
  | "siteAddress"
  | "contactEmail"
  | "contactPhone"
  | "socialFacebook"
  | "socialX"
  | "socialInstagram"
  | "socialTiktok"
  | "sitePublishState"
  | "description"
  | "tagline"
  | "name"
  | "logoUrl"
  | "primaryColor"
  | "slug"
  | "websiteUrl"
>;

export type HostSiteNavItem = {
  href: string;
  label: string;
  /** Primary CTA style (Book) */
  primary?: boolean;
};

/**
 * Fixed guest-site nav pages (load under sticky header chrome).
 * Services label comes from host.siteServicesTitle when set.
 */
export function hostSiteNavItems(
  host: Pick<
    Host,
    "sitePageAbout" | "sitePageServices" | "siteServicesTitle"
  >,
  basePath = "",
): HostSiteNavItem[] {
  const base = basePath || "";
  const items: HostSiteNavItem[] = [
    { href: base || "/", label: "Book", primary: true },
    { href: `${base}/stays` || "/stays", label: "Stays" },
  ];
  if (host.sitePageAbout) {
    items.push({ href: `${base}/about` || "/about", label: "About" });
  }
  if (host.sitePageServices) {
    const servicesLabel =
      host.siteServicesTitle?.trim() || "Services";
    items.push({
      href: `${base}/services` || "/services",
      label: servicesLabel,
    });
  }
  return items;
}

/** Short label for hero/footer CTAs (Services page display name). */
export function hostServicesPageLabel(
  host: Pick<Host, "siteServicesTitle">,
): string {
  return host.siteServicesTitle?.trim() || "Services";
}

export type HostSocialLink = {
  network: "facebook" | "x" | "instagram" | "tiktok";
  label: string;
  href: string;
};

/** Normalize user-entered social URLs (allow handle → full URL). */
export function normalizeSocialUrl(
  network: HostSocialLink["network"],
  raw: string | null | undefined,
): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const handle = t.replace(/^@/, "").replace(/^\//, "");
  if (!handle) return null;
  switch (network) {
    case "facebook":
      return `https://www.facebook.com/${handle}`;
    case "x":
      return `https://x.com/${handle}`;
    case "instagram":
      return `https://www.instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle.replace(/^@/, "")}`;
    default:
      return null;
  }
}

export function hostSocialLinks(
  host: Pick<
    Host,
    "socialFacebook" | "socialX" | "socialInstagram" | "socialTiktok"
  >,
): HostSocialLink[] {
  const out: HostSocialLink[] = [];
  const fb = normalizeSocialUrl("facebook", host.socialFacebook);
  if (fb) out.push({ network: "facebook", label: "Facebook", href: fb });
  const x = normalizeSocialUrl("x", host.socialX);
  if (x) out.push({ network: "x", label: "X", href: x });
  const ig = normalizeSocialUrl("instagram", host.socialInstagram);
  if (ig) out.push({ network: "instagram", label: "Instagram", href: ig });
  const tt = normalizeSocialUrl("tiktok", host.socialTiktok);
  if (tt) out.push({ network: "tiktok", label: "TikTok", href: tt });
  return out;
}

export function sitePublishStateLabel(state: HostSitePublishState): string {
  switch (state) {
    case "UNPUBLISHED":
      return "Unpublished (private)";
    case "DEMO":
      return "Demo (public preview)";
    case "LIVE":
      return "Live (production)";
    default:
      return state;
  }
}

/** Guest-visible when DEMO or LIVE (not UNPUBLISHED). */
export function isHostSiteGuestVisible(
  host: Pick<Host, "sitePublishState">,
): boolean {
  return (
    host.sitePublishState === "DEMO" || host.sitePublishState === "LIVE"
  );
}

export function isHostSiteDemo(
  host: Pick<Host, "sitePublishState">,
): boolean {
  return host.sitePublishState === "DEMO";
}

export function parseSitePublishState(
  raw: string | null | undefined,
): HostSitePublishState {
  if (raw === "DEMO" || raw === "LIVE" || raw === "UNPUBLISHED") return raw;
  return "UNPUBLISHED";
}
