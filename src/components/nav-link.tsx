"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Soft active (admin): petal pill + bonnet text */
export const NAV_ACTIVE =
  "bg-petal text-bonnet shadow-none hover:bg-petal-hover hover:text-bonnet-active";
/** Solid filled active (ops / emphasis) */
export const NAV_ACTIVE_SOLID =
  "bg-bonnet text-white shadow-sm hover:bg-bonnet-hover hover:text-white";
export const NAV_IDLE =
  "text-ink-muted hover:bg-petal/70 hover:text-ink";
export const NAV_IDLE_SOLID =
  "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Only match this path exactly (e.g. /admin dashboard). */
  exact?: boolean;
  /** Extra paths that count as active (e.g. query variants). */
  matchPrefixes?: string[];
  /**
   * Paths that should NOT mark this link active (e.g. /ops/hosting when on
   * /ops/hosting/plans — sibling nav item owns that route).
   */
  excludePrefixes?: string[];
  /** soft = petal pill (default); solid = filled brand button when active */
  variant?: "soft" | "solid";
};

function pathIsActive(
  pathname: string,
  href: string,
  exact?: boolean,
  matchPrefixes?: string[],
  excludePrefixes?: string[],
): boolean {
  const path = pathname.split("?")[0] || pathname;
  if (excludePrefixes?.some((p) => path === p || path.startsWith(p + "/"))) {
    return false;
  }
  if (exact) {
    return path === href;
  }
  if (matchPrefixes?.some((p) => path === p || path.startsWith(p + "/"))) {
    return true;
  }
  if (path === href) return true;
  if (href !== "/" && path.startsWith(href + "/")) return true;
  return false;
}

export function NavLink({
  href,
  children,
  className,
  exact,
  matchPrefixes,
  excludePrefixes,
  variant = "soft",
}: Props) {
  const pathname = usePathname() || "/";
  const active = pathIsActive(
    pathname,
    href,
    exact,
    matchPrefixes,
    excludePrefixes,
  );

  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium transition",
        variant === "solid"
          ? active
            ? NAV_ACTIVE_SOLID
            : NAV_IDLE_SOLID
          : active
            ? NAV_ACTIVE
            : NAV_IDLE,
        className,
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
