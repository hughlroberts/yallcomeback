import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PRODUCT_ORIGIN } from "@/lib/features";
import { getHostBySlugAny, getHostForGuestSite } from "@/lib/host";
import {
  brandedSiteGuestFallback,
  planIncludesBrandedSite,
} from "@/lib/plan-branded-site";

export {
  brandedSiteGuestFallback,
  planIncludesBrandedSite,
} from "@/lib/plan-branded-site";

export type HostPlanFields = {
  hostingMode: string;
  planId?: string | null;
  plan?: { slug: string } | null;
};

export async function planForBrandedSiteCheck(
  host: HostPlanFields,
): Promise<{ slug: string } | null> {
  if (host.plan) return host.plan;
  if (!host.planId) return null;
  return prisma.hostingPlan.findUnique({
    where: { id: host.planId },
    select: { slug: true },
  });
}

export async function planIncludesBrandedSiteForHost(
  host: HostPlanFields,
): Promise<boolean> {
  const plan = await planForBrandedSiteCheck(host);
  return planIncludesBrandedSite({ hostingMode: host.hostingMode, plan });
}

/** Absolute fallback so custom-domain rewrites cannot loop back onto /h/. */
export function brandedSiteGuestFallbackUrl(
  hostSlug: string,
  pathWithinBrand: string,
  search?: Record<string, string | undefined> | URLSearchParams | string,
): string {
  const origin = PRODUCT_ORIGIN.replace(/\/$/, "");
  return `${origin}${brandedSiteGuestFallback(hostSlug, pathWithinBrand, search)}`;
}

/**
 * If a public guest hit a /h/<brand>/ URL whose plan does not include a
 * branded site, send them to the marketplace equivalent. Owner/admin preview
 * is already allowed by getHostForGuestSite. Returns without redirect when
 * the brand is missing, unpublished, or otherwise not a plan-gate case so
 * the caller can 404.
 */
export async function redirectIfBrandedSiteGated(
  hostSlug: string,
  pathWithinBrand: string,
  search?: Record<string, string | undefined> | URLSearchParams | string,
): Promise<void> {
  if (await getHostForGuestSite(hostSlug)) return;
  const any = await getHostBySlugAny(hostSlug);
  if (!any?.active) return;
  if (await planIncludesBrandedSiteForHost(any)) return;
  redirect(brandedSiteGuestFallbackUrl(hostSlug, pathWithinBrand, search));
}

/** Load the host for a branded guest page, or redirect / 404. */
export async function requireBrandedGuestSite(
  hostSlug: string,
  pathWithinBrand: string,
  search?: Record<string, string | undefined> | URLSearchParams | string,
) {
  const host = await getHostForGuestSite(hostSlug);
  if (host) return host;
  await redirectIfBrandedSiteGated(hostSlug, pathWithinBrand, search);
  notFound();
}
