"use client";

import Link from "next/link";
import { Plane } from "lucide-react";
import { NavLink } from "@/components/nav-link";

type LinkItem = {
  href: string;
  label: string;
  exact?: boolean;
  matchPrefixes?: string[];
  excludePrefixes?: string[];
};

export function AdminNav({
  label,
  links,
}: {
  label: string;
  links: LinkItem[];
}) {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1 sm:px-6">
      <span className="shrink-0 text-sm font-semibold text-slate-900 sm:mr-3">
        {label}
      </span>
      <div className="-mx-1 flex items-center gap-0.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {links.map((l) => (
          <NavLink
            key={l.href}
            href={l.href}
            exact={l.exact}
            matchPrefixes={l.matchPrefixes}
            excludePrefixes={l.excludePrefixes}
            variant="solid"
          >
            {l.label}
          </NavLink>
        ))}
      </div>
      {/* Hosts can travel too: same account, no second sign-up. */}
      <div
        className="flex shrink-0 items-center gap-1 sm:ml-auto"
        data-testid="admin-travel-switch"
      >
        <Link
          href="/marketplace"
          prefetch={false}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm transition hover:border-bonnet/40 hover:text-bonnet"
        >
          <Plane className="size-4" strokeWidth={1.75} aria-hidden />
          Book a stay
        </Link>
        <Link
          href="/account/bookings"
          prefetch={false}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:text-bonnet"
        >
          My trips
        </Link>
      </div>
    </div>
  );
}
