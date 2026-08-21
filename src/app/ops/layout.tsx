import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OpsNav } from "@/components/ops-nav";
import { OpsHostManageChrome } from "@/components/ops-host-manage-chrome";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Private platform ops portal (hosting billing, plans, site settings).
 * When deep in /ops/hosting/[hostId], hide section tabs and show focused
 * “managing this website” chrome so Ops tabs don’t yank you out.
 */
export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePlatformAdmin();
  if (!session) {
    redirect("/login?callbackUrl=/ops&error=admin_only");
  }

  const h = await headers();
  const pathname = (h.get("x-pathname") || "").split("?")[0] || "";
  // /ops/hosting/<cuid> but not /ops/hosting or /ops/hosting/plans
  const manageMatch = pathname.match(/^\/ops\/hosting\/([^/]+)$/);
  const manageHostId =
    manageMatch?.[1] && manageMatch[1] !== "plans" ? manageMatch[1] : null;

  let manageHost: { id: string; name: string; slug: string } | null = null;
  if (manageHostId) {
    manageHost = await prisma.host.findUnique({
      where: { id: manageHostId },
      select: { id: true, name: true, slug: true },
    });
  }

  const focusedManage = Boolean(manageHost);

  const links = [
    {
      href: "/ops/hosting",
      label: "Website hosting",
      excludePrefixes: ["/ops/hosting/plans"],
    },
    { href: "/ops/hosting/plans", label: "Plans & pricing" },
    { href: "/ops/users", label: "Users" },
    { href: "/ops/pricing-comps", label: "Pricing comps" },
    { href: "/ops/managers", label: "Managers" },
    { href: "/ops/health", label: "Health" },
    { href: "/ops/settings", label: "Platform settings" },
  ];

  return (
    <div className="min-h-[calc(100vh-3.75rem)] bg-[var(--background)]">
      {focusedManage && manageHost ? (
        <OpsHostManageChrome
          hostId={manageHost.id}
          hostName={manageHost.name}
          hostSlug={manageHost.slug}
        />
      ) : (
        <div className="border-b border-slate-200/80 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-2.5 sm:px-6">
            <div className="mr-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Ops Panel
              </p>
              <Link
                href="/ops"
                className="text-sm font-semibold text-slate-900 hover:text-slate-700"
              >
                Yall Come Back ops
              </Link>
            </div>
            <OpsNav links={links} />
            <div className="ml-auto flex items-center gap-3 text-sm">
              <Link
                href="/admin"
                className="font-medium text-bonnet hover:text-bonnet-hover"
              >
                ← Host admin
              </Link>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}
