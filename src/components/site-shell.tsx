import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HostSiteHeader } from "@/components/host-site-header";
import { HostSiteFooter } from "@/components/host-site-footer";
import {
  getRequestTenant,
  hostBrandStyle,
} from "@/lib/tenant";
import { headers } from "next/headers";

/**
 * Picks YCB platform chrome vs host-owned chrome.
 * Host custom domains (and /h rewrites) never present YCB as the brand.
 */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const tenant = await getRequestTenant();

  if (!tenant) {
    return (
      <>
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </>
    );
  }

  // custom domain → /about; platform /h/slug preview → /h/slug/about
  const h = await headers();
  const mode = h.get("x-tenant-mode");
  const basePath = mode === "custom" ? "" : `/h/${tenant.slug}`;

  return (
    <div className="flex min-h-full flex-1 flex-col" style={hostBrandStyle(tenant)}>
      <HostSiteHeader host={tenant} basePath={basePath} />
      <main className="flex-1">{children}</main>
      <HostSiteFooter host={tenant} basePath={basePath} />
    </div>
  );
}
