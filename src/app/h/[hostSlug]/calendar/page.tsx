import { notFound, redirect } from "next/navigation";
import { getHostBySlug } from "@/lib/host";

export const dynamic = "force-dynamic";

export default async function HostCalendarRedirect({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await getHostBySlug(hostSlug);
  if (!host) notFound();
  redirect(`/marketplace?q=${encodeURIComponent(host.name)}`);
}
