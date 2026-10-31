import { redirect } from "next/navigation";
import { requirePlatformAdminOr404 } from "@/lib/auth";

export default async function OpsManagersRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Layout and page render in parallel: 404 non-admins here too, before redirecting.
  await requirePlatformAdminOr404();
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && value) q.set(key, value);
  }
  const s = q.toString();
  redirect(s ? `/ops/settings/managers?${s}` : "/ops/settings/managers");
}
