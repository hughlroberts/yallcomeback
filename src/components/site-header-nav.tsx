"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ACTIVE, NAV_IDLE } from "@/components/nav-link";
import { UserMenu, type UserMenuProps } from "@/components/user-menu";

type Props = UserMenuProps;

function activeFor(pathname: string, href: string): boolean {
  const path = pathname.split("?")[0] || pathname;
  if (href === "/marketplace") {
    return path === "/marketplace" || path.startsWith("/marketplace/");
  }
  if (href === "/saved") {
    return path === "/saved" || path.startsWith("/saved/");
  }
  if (href === "/admin") {
    return path.startsWith("/admin");
  }
  if (href === "/for-hosts") {
    return path === "/for-hosts" || path.startsWith("/for-hosts/");
  }
  return path === href || (href !== "/" && path.startsWith(href + "/"));
}

const LINK =
  "rounded-full px-3 py-1.5 text-sm font-medium transition whitespace-nowrap";

/**
 * Top chrome stays simple: travel (Stays) or host (List a stay / Listings).
 * Messages live under the account menu after sign-in — not a primary CTA.
 */
export function SiteHeaderNav(props: Props) {
  const pathname = usePathname() || "/";

  const listingHref = props.isHostOrAdmin ? "/admin" : "/for-hosts";
  const listingLabel = props.isHostOrAdmin ? "Listings" : "List a stay";

  // Primary destinations only — no Messages in the top bar
  const links: { href: string; label: string; show: boolean }[] = [
    { href: "/marketplace", label: "Stays", show: true },
    {
      href: listingHref,
      label: listingLabel,
      show: true,
    },
  ];

  return (
    <nav className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
      <div className="hidden items-center gap-0.5 sm:flex">
        {links
          .filter((l) => l.show)
          .map((l) => {
            const active = activeFor(pathname, l.href);
            return (
              <Link
                key={`${l.href}-${l.label}`}
                href={l.href}
                className={cn(LINK, active ? NAV_ACTIVE : NAV_IDLE)}
                aria-current={active ? "page" : undefined}
              >
                {l.label}
              </Link>
            );
          })}
      </div>

      {/* Phone: Stays only; List a stay / account in menu or CTA */}
      <div className="flex items-center gap-0.5 sm:hidden">
        <Link
          href="/marketplace"
          className={cn(
            LINK,
            activeFor(pathname, "/marketplace") ? NAV_ACTIVE : NAV_IDLE,
          )}
        >
          Stays
        </Link>
      </div>

      <UserMenu {...props} />
    </nav>
  );
}
