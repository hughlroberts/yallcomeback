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
  if (href === "/messages") {
    return path === "/messages" || path.startsWith("/messages/");
  }
  if (href === "/saved") {
    return path === "/saved" || path.startsWith("/saved/");
  }
  if (href === "/admin") {
    return path.startsWith("/admin");
  }
  return path === href || (href !== "/" && path.startsWith(href + "/"));
}

const LINK =
  "rounded-full px-3 py-1.5 text-sm font-medium transition whitespace-nowrap";

/**
 * Shared chrome for every account - guests and hosts see the same nav shape.
 * Hosts get an extra "Listings" link; nobody is pushed into a separate "mode".
 */
export function SiteHeaderNav(props: Props) {
  const pathname = usePathname() || "/";

  const links: { href: string; label: string; show: boolean }[] = [
    { href: "/marketplace", label: "Stays", show: true },
    { href: "/saved", label: "Wishlists", show: props.isSignedIn },
    { href: "/messages", label: "Messages", show: props.isSignedIn },
    {
      href: props.isHostOrAdmin ? "/admin" : "/for-hosts",
      label: "Listings",
      show: true,
    },
  ];

  return (
    <nav className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
      <div className="hidden items-center gap-0.5 lg:flex">
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

      {/* Tablet: key destinations */}
      <div className="hidden items-center gap-0.5 sm:flex lg:hidden">
        <Link
          href="/marketplace"
          className={cn(
            LINK,
            activeFor(pathname, "/marketplace") ? NAV_ACTIVE : NAV_IDLE,
          )}
        >
          Stays
        </Link>
        {props.isSignedIn ? (
          <Link
            href="/messages"
            className={cn(
              LINK,
              activeFor(pathname, "/messages") ? NAV_ACTIVE : NAV_IDLE,
            )}
          >
            Messages
          </Link>
        ) : null}
        <Link
          href={props.isHostOrAdmin ? "/admin" : "/for-hosts"}
          className={cn(
            LINK,
            activeFor(
              pathname,
              props.isHostOrAdmin ? "/admin" : "/for-hosts",
            )
              ? NAV_ACTIVE
              : NAV_IDLE,
          )}
        >
          Listings
        </Link>
      </div>

      {/* Phone: Stays only; rest in menu */}
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
