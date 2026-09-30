"use client";

import { NavLink } from "@/components/nav-link";
import { cn } from "@/lib/utils";

const ITEMS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/ops/settings", label: "Settings", exact: true },
  { href: "/ops/settings/managers", label: "Managers" },
  { href: "/ops/settings/health", label: "Health" },
  { href: "/ops/settings/backups", label: "Backups" },
];

/**
 * Left rail under Ops → Platform settings.
 */
export function OpsSettingsSidebar() {
  return (
    <aside className="lg:sticky lg:top-6 lg:w-52 lg:shrink-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Platform settings
      </p>
      <nav
        className="flex flex-row flex-wrap gap-1 lg:flex-col lg:gap-0.5"
        aria-label="Platform settings"
      >
        {ITEMS.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            exact={item.exact}
            variant="solid"
            className={cn(
              "flex justify-start rounded-lg px-3 py-2 lg:w-full",
            )}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
