/**
 * Host face vs brand logo.
 * - Profile/avatar: person guests message and “meet”
 * - Logo: optional mark for the guest website header only
 *
 * Note: files under /uploads on Railway are ephemeral (lost on redeploy).
 * Prefer durable paths under /public/brand or external URLs for logos.
 */

export type HostImageFields = {
  logoUrl?: string | null;
};

/** True for square badge / wordmark logos (not a face crop). */
export function looksLikeBrandLogoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const u = url.trim().toLowerCase();
  return (
    u.includes("/brand/") ||
    u.includes("logo") ||
    u.endsWith(".svg") ||
    // Uploaded host logos live here — treat as brand mark, not a face
    u.includes("/uploads/hosts/")
  );
}

/** Website chrome: logo if set, otherwise the host’s profile photo. */
export function hostSiteMarkUrl(
  host: HostImageFields,
  profileAvatarUrl?: string | null,
): string | null {
  const logo = host.logoUrl?.trim() || null;
  if (logo) return logo;
  const avatar = profileAvatarUrl?.trim() || null;
  return avatar || null;
}

/**
 * Guest-facing “person” photo.
 * Never substitute a brand logo badge for a face (that broke Meet your host
 * after logo upload). Avatar only; null → initials UI.
 */
export function hostProfileFaceUrl(
  _host: HostImageFields,
  profileAvatarUrl?: string | null,
): string | null {
  return profileAvatarUrl?.trim() || null;
}

export function hasCustomLogo(host: HostImageFields): boolean {
  return Boolean(host.logoUrl?.trim());
}

/** CSS object-fit for site mark: contain for logos, cover for faces. */
export function hostSiteMarkObjectFit(
  host: HostImageFields,
): "contain" | "cover" {
  return hasCustomLogo(host) || looksLikeBrandLogoUrl(host.logoUrl)
    ? "contain"
    : "cover";
}
