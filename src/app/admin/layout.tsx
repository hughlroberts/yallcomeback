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
import { isHostingPaused } from "@/lib/hosting";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  const role = dbUser?.role ?? session.user.role;
  if (role !== "ADMIN" && role !== "HOST") {
    redirect("/for-hosts?start=1");
  }

  const isPlatform = role === "ADMIN";
  const access = await requireHostAdmin();
  const accessInfo = resolveHostAccessInfo({
    isPlatform,
    hostId: access?.hostId ?? null,
    hostAccess: access?.hostAccess ?? session.user.hostAccess ?? null,
  });

  let hostPricingAccess: { pricingIntelligenceEnabled?: boolean } | null =
    null;
  let billingHost: {
    hostingMode: "PLATFORM" | "SELF";
    subscriptionStatus:
      | "NONE"
      | "PENDING_PAYMENT"
      | "ACTIVE"
      | "PAST_DUE"
      | "PAUSED"
      | "CANCELLED";
    active: boolean;
    approvalStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";
  } | null = null;
  let brandHosts: { id: string; name: string; slug: string }[] = [];
  let activeBrandId: string | null = null;

  if (!isPlatform && access?.hostId) {
    const row = await prisma.host.findUnique({
      where: { id: access.hostId },
      select: {
        pricingIntelligenceEnabled: true,
        hostingMode: true,
        subscriptionStatus: true,
        active: true,
        approvalStatus: true,
      },
    });
    hostPricingAccess = row;
    billingHost = row;
  }

  if (isPlatform) {
    activeBrandId = await getAdminBrandHostId();
    brandHosts = await prisma.host.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
      take: 100,
    });
    if (activeBrandId) {
      const row = await prisma.host.findUnique({
        where: { id: activeBrandId },
        select: {
          pricingIntelligenceEnabled: true,
          hostingMode: true,
          subscriptionStatus: true,
          active: true,
          approvalStatus: true,
        },
      });
      hostPricingAccess = row;
      billingHost = row;
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
    ...(canManageBrand(accessInfo)
      ? [{ href: "/admin/payments", label: "Payments" }]
      : []),
    ...(canViewEarnings(accessInfo)
      ? [
          { href: "/admin/earnings", label: "Earnings" },
          { href: "/admin/taxes", label: "Taxes" },
        ]
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
        {billingHost && billingHost.subscriptionStatus === "PAST_DUE" ? (
          <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Hosting payment is past due. You still have a short grace period.
            Pay under{" "}
            <Link href="/admin/payments" className="font-semibold underline">
              Payments
            </Link>{" "}
            so new listings and new stays stay available.
          </p>
        ) : null}
        {billingHost && isHostingPaused(billingHost) ? (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
            Hosting is paused for new work because payment is overdue. Existing
            listings and bookings stay here. You cannot add listings or take new
            stays until you{" "}
            <Link href="/admin/payments" className="font-semibold underline">
              pay hosting
            </Link>
            .
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
