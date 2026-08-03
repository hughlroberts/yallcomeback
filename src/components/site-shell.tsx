import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HostSiteHeader } from "@/components/host-site-header";
import { HostSiteFooter } from "@/components/host-site-footer";
import { HostSiteDemoBanner } from "@/components/host-site-demo-banner";
import {
  getRequestTenant,
  hostBrandStyle,
} from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Picks YCB platform chrome vs host-owned chrome.
 * Host custom domains (and /h rewrites) never present YCB as the brand.
 * Hosted sites are fixed-template (palette/logo + page toggles only).
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

  const session = await auth();
  const isOwnerPreview =
    session?.user?.role === "ADMIN" ||
    (session?.user?.role === "HOST" &&
      session.user.hostId === tenant.id);

  return (
    <div className="flex min-h-full flex-1 flex-col" style={hostBrandStyle(tenant)}>
      <HostSiteDemoBanner host={tenant} isOwnerPreview={isOwnerPreview} />
      <HostSiteHeader host={tenant} basePath={basePath} />
      <main className="flex-1">{children}</main>
      <HostSiteFooter host={tenant} basePath={basePath} />
    </div>
  );
}
