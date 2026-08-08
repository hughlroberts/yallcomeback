/**
 * Host face vs brand logo.
 * - Profile/avatar: person guests message and “meet”
 * - Logo: optional mark for the guest website header only
 */

export type HostImageFields = {
  logoUrl?: string | null;
};

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

/** Guest-facing “person” photo (never force a logo into the face circle). */
export function hostProfileFaceUrl(
  host: HostImageFields,
  profileAvatarUrl?: string | null,
): string | null {
  const avatar = profileAvatarUrl?.trim() || null;
  if (avatar) return avatar;
  // Legacy: some brands only stored a photo in logoUrl
  return host.logoUrl?.trim() || null;
}

export function hasCustomLogo(host: HostImageFields): boolean {
  return Boolean(host.logoUrl?.trim());
}
