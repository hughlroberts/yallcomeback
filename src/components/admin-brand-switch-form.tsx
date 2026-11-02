"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchAdminBrand } from "@/app/actions/admin-brand";

/** Brand picker form. Client side so the first click shows the new brand. */
export function AdminBrandSwitchForm({
  hosts,
  activeHostId,
  returnTo,
}: {
  hosts: { id: string; name: string }[];
  activeHostId: string | null;
  returnTo: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSwitch(formData: FormData) {
    startTransition(async () => {
      const result = await switchAdminBrand(formData);
      // Cookie is now set in the browser: navigate, then re-render the
      // server tree so the first click shows the new brand.
      router.replace(result.path);
      router.refresh();
    });
  }

  return (
    <form action={onSwitch} className="flex flex-wrap items-center gap-2">
      {/* No brand picked yet (after "Change brand"): land on the dashboard,
          /admin?brand=<slug>, not on a page of the previous brand. */}
      <input
        type="hidden"
        name="returnTo"
        value={activeHostId ? returnTo : "/admin"}
      />
      <label className="sr-only" htmlFor="admin-brand-select">
        Host brand
      </label>
      <select
        id="admin-brand-select"
        name="hostId"
        key={activeHostId || "none"}
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
        disabled={pending}
        className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950 disabled:opacity-60"
      >
        {pending ? "Switching…" : "Switch brand"}
      </button>
    </form>
  );
}

/**
 * "Change brand": forget the picked brand and go back to the brand picker.
 * Clears both brand cookies (same action as choosing no brand).
 */
export function AdminBrandClearButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClear(formData: FormData) {
    startTransition(async () => {
      const result = await switchAdminBrand(formData);
      router.replace(result.path);
      router.refresh();
    });
  }

  return (
    <form action={onClear}>
      <input type="hidden" name="hostId" value="" />
      <input type="hidden" name="returnTo" value="/admin" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60"
      >
        {pending ? "Changing…" : "Change brand"}
      </button>
    </form>
  );
}
