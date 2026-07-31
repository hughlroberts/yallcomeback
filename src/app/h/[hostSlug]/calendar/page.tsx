import { notFound, redirect } from "next/navigation";
import { getHostBySlug } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";

export const dynamic = "force-dynamic";

/** Legacy calendar URL → host stays list (stay on host brand). */
export default async function HostCalendarRedirect({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await getHostBySlug(hostSlug);
  if (!host) notFound();
  const base = await hostPublicBasePath(host.slug);
  redirect(`${base}/stays`);
}
