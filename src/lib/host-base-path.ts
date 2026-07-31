import { headers } from "next/headers";
import { hostSiteHref } from "@/lib/host";

/** Root-relative on custom domain; /h/slug when previewing on the platform. */
export async function hostPublicBasePath(hostSlug: string): Promise<string> {
  const h = await headers();
  if (h.get("x-tenant-mode") === "custom") return "";
  if (h.get("x-tenant-slug")) return hostSiteHref(hostSlug);
  return hostSiteHref(hostSlug);
}
