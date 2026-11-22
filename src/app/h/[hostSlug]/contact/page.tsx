import { redirect, notFound } from "next/navigation";
import { getHostForGuestSite } from "@/lib/host";
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
  const host = await getHostForGuestSite(hostSlug);
  if (!host) notFound();

  const base = await hostPublicBasePath(host.slug);

  if (host.sitePageAbout) {
    redirect(`${base}/about#contact`);
  }

  // About off — send guests to booking (the only always-on page)
  redirect(`${base}/stays`);
}
