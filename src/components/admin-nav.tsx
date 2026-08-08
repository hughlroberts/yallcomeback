"use client";

import { NavLink } from "@/components/nav-link";

type LinkItem = {
  href: string;
  label: string;
  exact?: boolean;
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
            excludePrefixes={l.excludePrefixes}
            variant="solid"
          >
            {l.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
