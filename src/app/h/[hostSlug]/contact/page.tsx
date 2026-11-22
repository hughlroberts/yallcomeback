import { redirect } from "next/navigation";
import { requireBrandedGuestSite } from "@/lib/branded-site-gate";
import { hostPublicBasePath } from "@/lib/host-base-path";

export const dynamic = "force-dynamic";

/**
 * Contact is part of the fixed About page (not a separate CMS page).
 * Keep this route for old links → About#contact when About is on.
 */
export default async function HostContactPage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await requireBrandedGuestSite(hostSlug, "/contact");

  const base = await hostPublicBasePath(host.slug);

  if (host.sitePageAbout) {
    redirect(`${base}/about#contact`);
  }

  // About off — send guests to booking (the only always-on page)
  redirect(`${base}/stays`);
}
