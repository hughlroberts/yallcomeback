import { prisma } from "@/lib/db";
import { requireHostAdmin } from "@/lib/auth";

export type HostAccess = NonNullable<
  Awaited<ReturnType<typeof requireHostAdmin>>
>;

export async function ensureHostAccess(): Promise<HostAccess> {
  const access = await requireHostAdmin();
  if (!access) throw new Error("Unauthorized");
  return access;
}

/**
 * Prisma where filter for host-scoped property queries.
 * - HOST users: always their brand.
 * - Platform ADMIN with brand cookie / hostId: that brand only.
 * - Platform ADMIN with no brand selected: empty scope (no rows) so personal
 *   and other brands never mix by accident — pick a brand first.
 */
export function propertyScopeWhere(access: HostAccess) {
  if (access.hostId) return { hostId: access.hostId };
  if (access.isPlatform) {
    // Unscoped platform view disabled — force brand picker
    return { hostId: "__pick_a_brand__" };
  }
  return { hostId: access.hostId! };
}

export function locationScopeWhere(access: HostAccess) {
  if (access.hostId) return { hostId: access.hostId };
  if (access.isPlatform) return { hostId: "__pick_a_brand__" };
  return { hostId: access.hostId! };
}

export function bookingScopeWhere(access: HostAccess) {
  if (access.hostId) return { property: { hostId: access.hostId } };
  if (access.isPlatform) {
    return { property: { hostId: "__pick_a_brand__" } };
  }
  return { property: { hostId: access.hostId! } };
}

export async function assertPropertyAccess(
  propertyId: string,
  access?: HostAccess
) {
  const a = access ?? (await ensureHostAccess());
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      ...propertyScopeWhere(a),
    },
  });
  if (!property) throw new Error("Unauthorized");
  return property;
}

export async function assertLocationAccess(
  locationId: string,
  access?: HostAccess
) {
  const a = access ?? (await ensureHostAccess());
  const location = await prisma.location.findFirst({
    where: {
      id: locationId,
      ...locationScopeWhere(a),
    },
  });
  if (!location) throw new Error("Unauthorized");
  return location;
}

export async function resolveHostIdForCreate(
  access: HostAccess,
  formData?: FormData
) {
  if (!access.isPlatform) {
    if (!access.hostId) throw new Error("Host account missing hostId");
    return access.hostId;
  }
  const fromForm = formData
    ? String(formData.get("hostId") || "").trim()
    : "";
  if (fromForm) {
    const host = await prisma.host.findFirst({
      where: { id: fromForm, active: true },
    });
    if (!host) throw new Error("Selected host not found");
    return host.id;
  }

  // Prefer brand context cookie (platform admin working as Cherokee, etc.)
  if (access.hostId) return access.hostId;

  // Platform admin must pick a host when more than one brand exists
  const hosts = await prisma.host.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
    take: 2,
  });
  if (hosts.length === 0) {
    throw new Error("Create a host before adding properties");
  }
  if (hosts.length > 1) {
    throw new Error(
      "Select a host brand in the admin bar before creating a listing",
    );
  }
  return hosts[0]!.id;
}
