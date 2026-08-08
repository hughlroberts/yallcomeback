import Link from "next/link";
import { redirect } from "next/navigation";
import { OpsNav } from "@/components/ops-nav";
import { requirePlatformAdmin } from "@/lib/auth";

/**
 * Private platform ops portal (hosting billing, plans, site settings).
 * Not linked from the main host admin nav — intended for the platform owner.
 */
export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Platform ADMIN only — hosts and guests never get this layout.
  const session = await requirePlatformAdmin();
  if (!session) {
    redirect("/login?callbackUrl=/ops&error=admin_only");
  }

  const links = [
    {
      href: "/ops/hosting",
      label: "Website hosting",
      // Don't stay "active" on /ops/hosting/plans
      excludePrefixes: ["/ops/hosting/plans"],
    },
    { href: "/ops/hosting/plans", label: "Plans & pricing" },
    { href: "/ops/users", label: "Users" },
    { href: "/ops/pricing-comps", label: "Pricing comps" },
    { href: "/ops/managers", label: "Managers" },
    { href: "/ops/settings", label: "Platform settings" },
  ];

  return (
    <div className="min-h-[calc(100vh-3.75rem)] bg-[var(--background)]">
      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-2.5 sm:px-6">
          <div className="mr-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Private
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
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}
