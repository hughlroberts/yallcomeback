import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HostSiteHeader } from "@/components/host-site-header";
import { HostSiteHeaderGate } from "@/components/host-site-header-gate";
import { HostSiteFooter } from "@/components/host-site-footer";
import { HostSiteDemoBanner } from "@/components/host-site-demo-banner";
import {
  getRequestTenant,
  hostBrandStyle,
} from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
  const isPlatformAdmin = session?.user?.role === "ADMIN";
  const isOwnerPreview =
    isPlatformAdmin ||
    (session?.user?.role === "HOST" &&
      session.user.hostId === tenant.id);

  // Profile face for header fallback (owner avatar preferred)
  const owner = await prisma.user.findFirst({
    where: {
      hostId: tenant.id,
      role: "HOST",
      OR: [{ hostAccess: "OWNER" }, { hostAccess: null }],
    },
    orderBy: { createdAt: "asc" },
    select: { avatarUrl: true },
  });
  const anyHostUser =
    owner ||
    (await prisma.user.findFirst({
      where: { hostId: tenant.id, role: "HOST" },
      orderBy: { createdAt: "asc" },
      select: { avatarUrl: true },
    }));

  return (
    <div className="flex min-h-full flex-1 flex-col" style={hostBrandStyle(tenant)}>
      <HostSiteDemoBanner
        host={tenant}
        isOwnerPreview={isOwnerPreview}
        isPlatformAdmin={isPlatformAdmin}
      />
      {/* Client gate: hide sticky nav only on landing home; restore on Stays/About/… */}
      <HostSiteHeaderGate basePath={basePath}>
        <HostSiteHeader
          host={tenant}
          profileAvatarUrl={anyHostUser?.avatarUrl}
          basePath={basePath}
        />
      </HostSiteHeaderGate>
      <main className="flex-1">{children}</main>
      <HostSiteFooter
        host={tenant}
        profileAvatarUrl={anyHostUser?.avatarUrl}
        basePath={basePath}
      />
    </div>
  );
}
