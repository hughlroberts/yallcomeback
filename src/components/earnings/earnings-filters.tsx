"use client";

import { Search } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

type Listing = { id: string; title: string };

type Props = {
  listings: Listing[];
  years: number[];
  showMethod?: boolean;
  showSearch?: boolean;
};

/**
 * Pill filters: search · dates/year · listings · earnings type / method
 */
export function EarningsFilters({
  listings,
  years,
  showMethod = false,
  showSearch = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
      startTransition(() => {
        const q = next.toString();
        router.push(q ? `${pathname}?${q}` : pathname);
      });
    },
    [pathname, router, sp],
  );

  const pill =
    "appearance-none rounded-full border border-stone-300 bg-white py-2 pl-3.5 pr-8 text-sm text-stone-700 shadow-sm hover:border-stone-400 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-100";

  return (
    <div
      className={`mt-5 flex flex-wrap items-center gap-2 ${pending ? "opacity-70" : ""}`}
    >
      {showSearch ? (
        <label className="relative flex min-w-[10rem] flex-1 items-center sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 size-4 text-stone-400"
            strokeWidth={1.75}
          />
          <input
            type="search"
            name="q"
            defaultValue={sp.get("q") || ""}
            placeholder="Search"
            className="w-full rounded-full border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm text-stone-800 shadow-sm placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-100"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setParam("q", (e.target as HTMLInputElement).value);
              }
            }}
            onBlur={(e) => setParam("q", e.target.value)}
          />
        </label>
      ) : null}

      <select
        className={pill}
        value={sp.get("year") || "all"}
        onChange={(e) => setParam("year", e.target.value)}
        aria-label="Dates"
      >
        <option value="all">All dates</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>

      <select
        className={pill}
        value={sp.get("listing") || "all"}
        onChange={(e) => setParam("listing", e.target.value)}
        aria-label="Listings"
      >
        <option value="all">All listings</option>
        {listings.map((l) => (
          <option key={l.id} value={l.id}>
            {l.title}
          </option>
        ))}
      </select>

      {showMethod ? (
        <select
          className={pill}
          value={sp.get("method") || "all"}
          onChange={(e) => setParam("method", e.target.value)}
          aria-label="Payout methods"
        >
          <option value="all">All payout methods</option>
          <option value="MANUAL">Manual / bank</option>
          <option value="STRIPE">Card (Stripe)</option>
          <option value="BITCOIN">Bitcoin</option>
        </select>
      ) : (
        <select
          className={pill}
          value={sp.get("type") || "all"}
          onChange={(e) => setParam("type", e.target.value)}
          aria-label="Earnings types"
        >
          <option value="all">All earnings types</option>
          <option value="deposit">Deposits</option>
          <option value="balance">Stay balance</option>
        </select>
      )}
    </div>
  );
}
