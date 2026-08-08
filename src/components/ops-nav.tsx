"use client";

import { NavLink } from "@/components/nav-link";

type LinkItem = {
  href: string;
  label: string;
  exact?: boolean;
  excludePrefixes?: string[];
};

/** Ops top nav — solid filled pill on the active page. */
export function OpsNav({ links }: { links: LinkItem[] }) {
  return (
    <nav
      className="flex flex-wrap items-center gap-0.5"
      aria-label="Ops sections"
    >
      {links.map((l) => (
        <NavLink
          key={l.href}
          href={l.href}
          exact={l.exact}
          excludePrefixes={l.excludePrefixes}
          variant="solid"
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
