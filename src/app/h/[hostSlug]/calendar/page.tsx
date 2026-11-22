import { redirect } from "next/navigation";
import { requireBrandedGuestSite } from "@/lib/branded-site-gate";
import { hostPublicBasePath } from "@/lib/host-base-path";

export const dynamic = "force-dynamic";

/** Legacy calendar URL → host stays list (stay on host brand). */
export default async function HostCalendarRedirect({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await requireBrandedGuestSite(hostSlug, "/calendar");
  const base = await hostPublicBasePath(host.slug);
  redirect(`${base}/stays`);
}
