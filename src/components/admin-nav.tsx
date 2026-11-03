"use client";

import Link from "next/link";
import { Luggage, Plane } from "lucide-react";
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
    // T25: one row on phones (links scroll, travel links as icons); the
    // label shows from sm up.
    <div className="mx-auto flex max-w-[1400px] flex-row items-center gap-1.5 px-3 py-1.5 sm:flex-wrap sm:gap-1 sm:px-6 sm:py-2.5">
      <span className="hidden shrink-0 text-sm font-semibold text-slate-900 sm:mr-3 sm:inline">
        {label}
      </span>
      <div className="-mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] sm:flex-none sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
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
          aria-label="Book a stay"
          title="Book a stay"
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white p-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-bonnet/40 hover:text-bonnet sm:px-3 sm:py-1.5"
        >
          <Plane className="size-4" strokeWidth={1.75} aria-hidden />
          <span className="hidden sm:inline">Book a stay</span>
        </Link>
        <Link
          href="/account/bookings"
          prefetch={false}
          aria-label="My trips"
          title="My trips"
          className="inline-flex items-center rounded-full p-2 text-sm font-medium text-stone-600 transition hover:text-bonnet sm:px-3 sm:py-1.5"
        >
          <Luggage className="size-4 sm:hidden" strokeWidth={1.75} aria-hidden />
          <span className="hidden sm:inline">My trips</span>
        </Link>
      </div>
    </div>
  );
}
