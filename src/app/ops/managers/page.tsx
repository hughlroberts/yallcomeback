import { redirect } from "next/navigation";

export default async function OpsManagersRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && value) q.set(key, value);
  }
  const s = q.toString();
  redirect(s ? `/ops/settings/managers?${s}` : "/ops/settings/managers");
}
