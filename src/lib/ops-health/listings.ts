import { prisma } from "@/lib/db";
import type { HealthFinding } from "./types";

function findingId(...parts: string[]): string {
  return parts.filter(Boolean).join(":");
}

export async function runListingChecks(opts?: {
  hostId?: string;
}): Promise<HealthFinding[]> {
  const findings: HealthFinding[] = [];
  const hostFilter = opts?.hostId ? { hostId: opts.hostId } : {};

  const properties = await prisma.property.findMany({
    where: hostFilter,
    select: {
      id: true,
      title: true,
      published: true,
      listOnMarketplace: true,
      baseNightlyRate: true,
      city: true,
      latitude: true,
      longitude: true,
      hostId: true,
      host: { select: { id: true, name: true } },
      _count: { select: { images: true } },
    },
  });

  for (const p of properties) {
    if (p.published && p._count.images === 0) {
      findings.push({
        id: findingId("noimg", p.id),
        checkId: "published_no_images",
        severity: "warning",
        title: "Published listing has no photos",
        detail: "Guests see an empty gallery. Add at least one image before promoting.",
        hostId: p.host.id,
        hostName: p.host.name,
        propertyId: p.id,
        propertyTitle: p.title,
        href: `/admin/properties/${p.id}`,
      });
    }

    if (p.published && !(p.baseNightlyRate > 0)) {
      findings.push({
        id: findingId("noprice", p.id),
        checkId: "published_no_price",
        severity: "warning",
        title: "Published listing has no nightly rate",
        detail: `baseNightlyRate is ${p.baseNightlyRate}. Quotes will look wrong or fail.`,
        hostId: p.host.id,
        hostName: p.host.name,
        propertyId: p.id,
        propertyTitle: p.title,
        href: `/admin/properties/${p.id}`,
      });
    }

    if (
      p.published &&
      (!p.city?.trim() || p.latitude == null || p.longitude == null)
    ) {
      findings.push({
        id: findingId("noloc", p.id),
        checkId: "published_no_location",
        severity: "warning",
        title: "Published listing missing location",
        detail: "City and/or map coordinates are empty. Marketplace search and maps suffer.",
        hostId: p.host.id,
        hostName: p.host.name,
        propertyId: p.id,
        propertyTitle: p.title,
        href: `/admin/properties/${p.id}`,
      });
    }

    if (p.listOnMarketplace && !p.published) {
      findings.push({
        id: findingId("mkt-unpub", p.id),
        checkId: "marketplace_unpublished",
        severity: "info",
        title: "Marketplace flag on but listing unpublished",
        detail: "listOnMarketplace is true while published is false — it will not appear on Find a Place.",
        hostId: p.host.id,
        hostName: p.host.name,
        propertyId: p.id,
        propertyTitle: p.title,
        href: `/admin/properties/${p.id}`,
      });
    }
  }

  const hosts = await prisma.host.findMany({
    where: {
      ...(opts?.hostId ? { id: opts.hostId } : {}),
      approvalStatus: "APPROVED",
      active: true,
    },
    select: {
      id: true,
      name: true,
      sitePublishState: true,
      customDomain: true,
      websiteUrl: true,
      sitePresence: true,
      _count: {
        select: {
          properties: { where: { published: true } },
        },
      },
    },
  });

  for (const h of hosts) {
    if (h._count.properties === 0) {
      findings.push({
        id: findingId("host-empty", h.id),
        checkId: "host_no_published",
        severity: "info",
        title: "Approved host has no published listings",
        detail: `${h.name} is active/approved but has zero published stays.`,
        hostId: h.id,
        hostName: h.name,
        href: `/ops/hosting/${h.id}`,
      });
    }

    if (
      h.sitePresence !== "STAYLOCAL" &&
      h.sitePublishState === "LIVE" &&
      !h.customDomain?.trim()
    ) {
      findings.push({
        id: findingId("live-nodomain", h.id),
        checkId: "demo_live_mismatch",
        severity: "info",
        title: "Site marked Live without a custom domain",
        detail: "Publish state is Live but Custom domain is empty. Guests still use /h/ preview unless DNS is set up separately.",
        hostId: h.id,
        hostName: h.name,
        href: `/admin/brand?hostId=${h.id}`,
      });
    }
  }

  return findings;
}
