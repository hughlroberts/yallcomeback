import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { AdminBrandSwitcher } from "@/components/admin-brand-switcher";
import { auth, requireHostAdmin } from "@/lib/auth";
import { getAdminBrandHostId } from "@/lib/admin-brand-context";
import { prisma } from "@/lib/db";
import {
  canManageBrand,
  canManageTeam,
  canViewEarnings,
  resolveHostAccessInfo,
} from "@/lib/host-access";
import { canSeePricingIntelligenceNav } from "@/lib/platform-features";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "HOST")
  ) {
    redirect("/login?callbackUrl=/admin");
  }

  const isPlatform = session.user.role === "ADMIN";
  const access = await requireHostAdmin();
  const accessInfo = resolveHostAccessInfo({
    isPlatform,
    hostId: access?.hostId ?? null,
    hostAccess: access?.hostAccess ?? session.user.hostAccess,
  });

  let hostPricingAccess: { pricingIntelligenceEnabled?: boolean } | null =
    null;
  let brandHosts: { id: string; name: string; slug: string }[] = [];
  let activeBrandId: string | null = null;

  if (!isPlatform && session.user.hostId) {
    hostPricingAccess = await prisma.host.findUnique({
      where: { id: session.user.hostId },
      select: { pricingIntelligenceEnabled: true },
    });
  }

  if (isPlatform) {
    activeBrandId = await getAdminBrandHostId();
    brandHosts = await prisma.host.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
      take: 100,
    });
    if (activeBrandId) {
      hostPricingAccess = await prisma.host.findUnique({
        where: { id: activeBrandId },
        select: { pricingIntelligenceEnabled: true },
      });
    }
  }

  const showPricing = canSeePricingIntelligenceNav({
    isPlatformAdmin: isPlatform,
    host: hostPricingAccess,
  });

  const links = [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/admin/properties", label: "Properties" },
    ...(canManageBrand(accessInfo)
      ? [{ href: "/admin/brand", label: "Brand & website" }]
      : []),
    // Secret / paid beta: platform admin always; hosts only if ops toggled access
    ...(showPricing && canManageBrand(accessInfo)
      ? [{ href: "/admin/pricing", label: "Pricing intelligence" }]
      : []),
    { href: "/admin/magnets", label: "Fridge magnets" },
    { href: "/admin/bookings", label: "Bookings" },
    ...(canViewEarnings(accessInfo)
      ? [{ href: "/admin/earnings", label: "Earnings" }]
      : []),
    { href: "/admin/messages", label: "Messages" },
    { href: "/admin/guest-messages", label: "Message templates" },
    ...(canManageTeam(accessInfo)
      ? [{ href: "/admin/team", label: "Team" }]
      : []),
  ];

  const h = await headers();
  const path =
    h.get("x-pathname") ||
    h.get("x-invoke-path") ||
    h.get("next-url") ||
    "/admin";
  const returnTo = path.startsWith("/admin") ? path.split("?")[0]! : "/admin";

  return (
    <div className="flex min-h-[calc(100vh-3.75rem)] flex-col bg-[var(--background)]">
      {isPlatform && brandHosts.length > 0 ? (
        <AdminBrandSwitcher
          hosts={brandHosts}
          activeHostId={activeBrandId}
          returnTo={returnTo}
        />
      ) : null}
      <div className="shrink-0 border-b border-slate-200/80 bg-white">
        <AdminNav
          label={
            isPlatform
              ? activeBrandId
                ? "Admin · brand scope"
                : "Admin · pick brand"
              : "Listings & bookings"
          }
          links={links}
        />
      </div>
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}
