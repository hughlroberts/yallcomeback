import { prisma } from "@/lib/db";
import { homeAfterLogin } from "@/lib/login-home";
import { slugify } from "@/lib/utils";

/** First-run after creating a host: add a listing, not billing. */
export const FIRST_LISTING_PATH = "/admin/properties/new?welcome=1";

export function signupNeedsBrandFields(opts: {
  hostingMode: "PLATFORM" | "SELF";
  sitePresence: "STAYLOCAL" | "CUSTOM" | "BOTH";
}): boolean {
  if (opts.hostingMode === "SELF") return true;
  return opts.sitePresence !== "STAYLOCAL";
}

/** Marketplace hosts use the person's name. Brand name is only for a website. */
export function hostRecordName(opts: {
  personalName: string;
  brandName: string;
  needsBrand: boolean;
}): string {
  const brand = opts.brandName.trim();
  const personal = opts.personalName.trim();
  if (opts.needsBrand) return brand;
  return brand || personal;
}

export async function uniqueHostSlug(base: string): Promise<string> {
  const root = slugify(base) || "host";
  let candidate = root;
  for (let n = 2; n < 80; n++) {
    const hit = await prisma.host.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${root}-${n}`;
  }
  return `${root}-${Date.now().toString(36).slice(-4)}`;
}

/**
 * Returning hosts with listings go to Calendar.
 * A host who has not added a stay yet goes to create a listing —
 * unless they were headed into a real admin/ops/account page.
 */
export async function destAfterHostAuth(opts: {
  role: string | null | undefined;
  hostId: string | null | undefined;
  callback?: unknown;
}): Promise<string> {
  const next = homeAfterLogin(opts.role, opts.callback);
  if (opts.role !== "HOST") return next;
  if (next !== "/admin/calendar") return next;
  if (!opts.hostId) return FIRST_LISTING_PATH;
  const n = await prisma.property.count({ where: { hostId: opts.hostId } });
  return n === 0 ? FIRST_LISTING_PATH : next;
}
