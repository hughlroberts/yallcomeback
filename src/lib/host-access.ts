/**
 * Host brand permissions: OWNER / FULL / LIMITED co-hosts + platform admin.
 */

import type { HostAccessLevel } from "@prisma/client";
import type { HostAccess } from "@/lib/scope";

export type HostAccessInfo = {
  /** Effective level for UI gates; platform admin acts as OWNER of selected brand */
  level: HostAccessLevel | "PLATFORM";
  isPlatform: boolean;
  hostId: string | null;
};

export function hostAccessLabel(level: HostAccessLevel | "PLATFORM" | null | undefined): string {
  switch (level) {
    case "PLATFORM":
      return "Platform admin";
    case "OWNER":
      return "Owner";
    case "FULL":
      return "Full co-host";
    case "LIMITED":
      return "Limited co-host";
    default:
      return "—";
  }
}

export function hostAccessDescription(level: HostAccessLevel): string {
  switch (level) {
    case "OWNER":
      return "Full control of the brand, team invites, and listings.";
    case "FULL":
      return "Manage listings, brand site, bookings, messages, and earnings. Cannot remove the owner or access platform ops.";
    case "LIMITED":
      return "Help with day-to-day hosting: calendars, bookings, messages, and listing content. No brand settings, team, or earnings.";
  }
}

/** Normalize DB value for HOST users (legacy null → OWNER). */
export function normalizeHostAccess(
  level: HostAccessLevel | null | undefined,
): HostAccessLevel {
  return level ?? "OWNER";
}

export function resolveHostAccessInfo(access: {
  isPlatform: boolean;
  hostId: string | null;
  hostAccess?: HostAccessLevel | null;
}): HostAccessInfo {
  if (access.isPlatform) {
    return {
      level: "PLATFORM",
      isPlatform: true,
      hostId: access.hostId,
    };
  }
  return {
    level: normalizeHostAccess(access.hostAccess),
    isPlatform: false,
    hostId: access.hostId,
  };
}

/** Listings, calendar, photos, amenities, bookings, messages, insights */
export function canManageDayToDayHosting(info: HostAccessInfo): boolean {
  return info.level !== undefined;
}

/** Create new listings, duplicate, setup wizard */
export function canCreateListings(info: HostAccessInfo): boolean {
  return (
    info.isPlatform ||
    info.level === "OWNER" ||
    info.level === "FULL"
  );
}

export function canDeleteListings(info: HostAccessInfo): boolean {
  return info.isPlatform || info.level === "OWNER" || info.level === "FULL";
}

/** Brand & website editor */
export function canManageBrand(info: HostAccessInfo): boolean {
  return info.isPlatform || info.level === "OWNER" || info.level === "FULL";
}

/** Earnings / payouts views */
export function canViewEarnings(info: HostAccessInfo): boolean {
  return info.isPlatform || info.level === "OWNER" || info.level === "FULL";
}

/** Invite / remove co-hosts */
export function canManageTeam(info: HostAccessInfo): boolean {
  return info.isPlatform || info.level === "OWNER";
}

/** Hosting plan / subscription (platform-facing) — owner only among hosts */
export function canManageHostingBilling(info: HostAccessInfo): boolean {
  return info.isPlatform || info.level === "OWNER";
}

export function canAccessAdmin(info: HostAccessInfo): boolean {
  return true; // only called when already HOST/ADMIN
}

/** Extend HostAccess with permission flags for pages */
export function withHostPermissions(access: HostAccess & { hostAccess?: HostAccessLevel | null }) {
  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  return {
    ...access,
    hostAccess: info.level === "PLATFORM" ? null : info.level,
    accessInfo: info,
    canCreateListings: canCreateListings(info),
    canDeleteListings: canDeleteListings(info),
    canManageBrand: canManageBrand(info),
    canViewEarnings: canViewEarnings(info),
    canManageTeam: canManageTeam(info),
    canManageHostingBilling: canManageHostingBilling(info),
  };
}
