"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Brand active nav: petal pill + bonnet text (never honey as light-mode button). */
export const NAV_ACTIVE =
  "bg-petal text-bonnet shadow-none hover:bg-petal-hover hover:text-bonnet-active";
export const NAV_IDLE =
  "text-ink-muted hover:bg-petal/70 hover:text-ink";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Only match this path exactly (e.g. /admin dashboard). */
  exact?: boolean;
  /** Extra paths that count as active (e.g. query variants). */
  matchPrefixes?: string[];
};

function pathIsActive(
  pathname: string,
  href: string,
  exact?: boolean,
  matchPrefixes?: string[],
): boolean {
  const path = pathname.split("?")[0] || pathname;
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
}: Props) {
  const pathname = usePathname() || "/";
  const active = pathIsActive(pathname, href, exact, matchPrefixes);

  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium transition",
        active ? NAV_ACTIVE : NAV_IDLE,
        className,
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
