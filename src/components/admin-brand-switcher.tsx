import Link from "next/link";
import { AdminBrandClearButton, AdminBrandSwitchForm } from "@/components/admin-brand-switch-form";

type HostOption = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Platform-admin only: pick which host brand /admin is scoped to.
 * Prevents Hugh’s personal listings from appearing while managing Cherokee.
 * Exit to Ops is the intentional way back to the platform panel.
 */
export function AdminBrandSwitcher({
  hosts,
  activeHostId,
  returnTo = "/admin",
}: {
  hosts: HostOption[];
  activeHostId: string | null;
  returnTo?: string;
}) {
  const active = hosts.find((h) => h.id === activeHostId) ?? null;

  return (
    <div className="border-b border-amber-200/80 bg-amber-50">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0 text-sm text-amber-950">
          <span className="font-semibold">Managing website</span>
          <span className="mx-1.5 text-amber-700/70">·</span>
          {active ? (
            <strong className="font-semibold">{active.name}</strong>
          ) : (
            <span className="font-medium text-amber-900">
              Select a brand below — listings stay empty until you do (so brands
              never mix).
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminBrandSwitchForm
            hosts={hosts}
            activeHostId={activeHostId}
            returnTo={returnTo}
          />
          {active ? <AdminBrandClearButton /> : null}
          {active ? (
            <Link
              href={`/h/${active.slug}`}
              target="_blank"
              className="text-xs font-semibold text-amber-950 underline underline-offset-2"
            >
              Guest site →
            </Link>
          ) : null}
          <Link
            href="/ops"
            className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
          >
            ← Exit to Ops Panel
          </Link>
        </div>
      </div>
    </div>
  );
}
