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

/** Prisma where filter for host-scoped property queries */
export function propertyScopeWhere(access: HostAccess) {
  if (access.isPlatform) return {};
  return { hostId: access.hostId! };
}

export function locationScopeWhere(access: HostAccess) {
  if (access.isPlatform) return {};
  return { hostId: access.hostId! };
}

export function bookingScopeWhere(access: HostAccess) {
  if (access.isPlatform) return {};
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
  if (fromForm) return fromForm;

  // Platform admin without explicit host: use first active host or create none
  const first = await prisma.host.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!first) throw new Error("Create a host before adding properties");
  return first.id;
}
