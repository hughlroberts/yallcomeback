import Link from "next/link";
import { redirect } from "next/navigation";
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
    { href: "/ops/hosting", label: "Website hosting" },
    { href: "/ops/hosting/plans", label: "Plans & pricing" },
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
          <nav className="flex flex-wrap items-center gap-0.5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link
              href="/admin"
              className="font-medium text-bonnet hover:text-bonnet"
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
