"use client";

import { NavLink } from "@/components/nav-link";

type LinkItem = { href: string; label: string; exact?: boolean };

export function AdminNav({
  label,
  links,
}: {
  label: string;
  links: LinkItem[];
}) {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-1 px-4 py-2.5 sm:px-6">
      <span className="mr-3 text-sm font-semibold text-slate-900">{label}</span>
      <div className="flex flex-wrap items-center gap-0.5">
        {links.map((l) => (
          <NavLink key={l.href} href={l.href} exact={l.exact}>
            {l.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
