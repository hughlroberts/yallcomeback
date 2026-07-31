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
    return (
      path === "/for-hosts" ||
      path.startsWith("/for-hosts/") ||
      path === "/self-host" ||
      path.startsWith("/self-host/")
    );
  }
  return path === href || (href !== "/" && path.startsWith(href + "/"));
}

const FIND_LINK =
  "rounded-full px-3 py-1.5 text-sm font-medium transition whitespace-nowrap";

/**
 * Top chrome: guest world (Find a Place) vs host world (Host a Place).
 * Host is styled as its own CTA — like VRBO’s list-property entry —
 * while still routing into YCB’s dual-path host story (paid + free self-host).
 * Messages live under the account menu after sign-in.
 */
export function SiteHeaderNav(props: Props) {
  const pathname = usePathname() || "/";

  // Guests land on the host pitch; hosts jump to their portal.
  const hostHref = props.isHostOrAdmin ? "/admin" : "/for-hosts";
  const findActive = activeFor(pathname, "/marketplace");
  const hostActive = props.isHostOrAdmin
    ? activeFor(pathname, "/admin")
    : activeFor(pathname, "/for-hosts");

  return (
    <nav className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-3">
      {/* Guest side */}
      <div className="flex items-center">
        <Link
          href="/marketplace"
          className={cn(FIND_LINK, findActive ? NAV_ACTIVE : NAV_IDLE)}
          aria-current={findActive ? "page" : undefined}
        >
          <span className="sm:hidden">Find</span>
          <span className="hidden sm:inline">Find a Place</span>
        </Link>
      </div>

      {/* Visual split between guest travel and host product */}
      <span
        className="hidden h-5 w-px shrink-0 bg-stone-200 sm:block"
        aria-hidden
      />

      {/* Host side — standalone CTA, not another muted nav link */}
      <Link
        href={hostHref}
        className={cn(
          "rounded-full px-3 py-1.5 text-sm font-semibold transition whitespace-nowrap sm:px-3.5",
          hostActive
            ? "bg-bonnet text-white shadow-sm hover:bg-bonnet-hover"
            : "border border-bonnet/25 bg-white text-bonnet shadow-sm hover:border-bonnet/40 hover:bg-petal",
        )}
        aria-current={hostActive ? "page" : undefined}
      >
        <span className="sm:hidden">Host</span>
        <span className="hidden sm:inline">Host a Place</span>
      </Link>

      <UserMenu {...props} />
    </nav>
  );
}
