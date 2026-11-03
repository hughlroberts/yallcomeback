import Link from "next/link";
import { AdminBrandClearButton, AdminBrandSwitchForm } from "@/components/admin-brand-switch-form";
import { AdminBrandBarToggle } from "@/components/admin-brand-bar-toggle";

type HostOption = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Platform-admin only: pick which host brand /admin is scoped to.
 * Prevents Hugh’s personal listings from appearing while managing Cherokee.
 * "← Platform admin" is the intentional way back to the platform panel.
 * T25: on phones the controls fold behind a "Brand" button (one row).
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
      <AdminBrandBarToggle
        summary={
          <>
            <span className="hidden font-semibold sm:inline">Managing website</span>
            <span className="mx-1.5 hidden text-amber-700/70 sm:inline">·</span>
            {active ? (
              <strong className="font-semibold">{active.name}</strong>
            ) : (
              <span className="font-medium text-amber-900">
                <span className="sm:hidden">Select a brand</span>
                <span className="hidden sm:inline">
                  Select a brand below — listings stay empty until you do (so
                  brands never mix).
                </span>
              </span>
            )}
          </>
        }
        action={
          <Link
            href="/ops"
            aria-label="Platform admin"
            className="inline-flex items-center rounded-lg bg-stone-900 px-2 py-1 text-xs font-semibold text-white hover:bg-stone-800"
          >
            ← Platform admin
          </Link>
        }
      >
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
          className="hidden rounded-lg bg-stone-900 px-3 sm:inline-flex py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
        >
          ← Platform admin
        </Link>
      </AdminBrandBarToggle>
    </div>
  );
}
