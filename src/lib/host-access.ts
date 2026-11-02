/**
 * Host brand permissions: OWNER / FULL / LIMITED co-hosts + platform admin.
 */

import type { HostAccessLevel } from "@prisma/client";

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
      return "Manage listings, brand site, bookings, messages, and earnings. Cannot remove the owner or access platform administration.";
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
