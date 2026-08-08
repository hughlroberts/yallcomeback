import Link from "next/link";
import { setAdminBrandContext } from "@/app/actions/admin-brand";

type HostOption = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Platform-admin only: pick which host brand /admin is scoped to.
 * Prevents Hugh’s personal listings from appearing while managing Cherokee.
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
          <span className="font-semibold">Platform admin</span>
          <span className="mx-1.5 text-amber-700/70">·</span>
          {active ? (
            <>
              Managing brand:{" "}
              <strong className="font-semibold">{active.name}</strong>
              <span className="ml-1 text-xs text-amber-800/80">
                ({active.slug})
              </span>
            </>
          ) : (
            <span className="font-medium text-amber-900">
              Select a brand below — listings stay empty until you do (so brands
              never mix).
            </span>
          )}
        </div>
        <form
          action={setAdminBrandContext}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="sr-only" htmlFor="admin-brand-select">
            Host brand
          </label>
          <select
            id="admin-brand-select"
            name="hostId"
            defaultValue={activeHostId || ""}
            className="max-w-[16rem] rounded-lg border border-amber-300/80 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-900"
          >
            <option value="">Choose brand…</option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950"
          >
            Switch brand
          </button>
          {active ? (
            <Link
              href={`/h/${active.slug}`}
              target="_blank"
              className="text-xs font-semibold text-amber-950 underline underline-offset-2"
            >
              Guest site →
            </Link>
          ) : null}
        </form>
      </div>
    </div>
  );
}
