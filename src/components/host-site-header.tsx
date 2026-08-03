import Image from "next/image";
import Link from "next/link";
import type { Host } from "@prisma/client";
import { cn } from "@/lib/utils";
import { hostSiteNavItems } from "@/lib/host-site";

type Props = {
  host: Pick<
    Host,
    "name" | "slug" | "logoUrl" | "tagline" | "sitePageAbout" | "sitePageServices"
  >;
  /** Public paths on custom domain are root-relative (/about); on platform use /h/slug */
  basePath?: string;
};

/**
 * Guest chrome for a host-owned site (custom domain or /h/[slug]).
 * Fixed nav only: Book/Stays always; About & Services when toggled on.
 * Not a freeform CMS — no arbitrary pages.
 */
export function HostSiteHeader({ host, basePath = "" }: Props) {
  const home = basePath || "/";
  const nav = hostSiteNavItems(host, basePath);
  // Book CTA points at stays catalog
  const bookHref = `${basePath}/stays` || "/stays";

  return (
    <header className="sticky top-0 z-[200] border-b border-stone-200/80 bg-white/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6 md:min-h-[4.5rem]">
        <Link
          href={home}
          className="flex min-w-0 items-center gap-2.5 sm:gap-3"
          aria-label={`${host.name}, home`}
        >
          {host.logoUrl ? (
            <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200/80 sm:size-12">
              <Image
                src={host.logoUrl}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
                priority
                unoptimized
              />
            </span>
          ) : (
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand,#2563eb)] text-sm font-semibold text-white sm:size-12 sm:text-base"
              aria-hidden
            >
              {host.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-medium tracking-tight text-stone-900 sm:text-xl">
              {host.name}
            </span>
            {host.tagline ? (
              <span className="hidden truncate text-xs text-stone-500 sm:block">
                {host.tagline}
              </span>
            ) : null}
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {nav
            .filter((item) => !item.primary)
            .map((item) => (
              <HeaderNavLink
                key={item.href}
                href={item.href}
                className={
                  item.label === "About" || item.label === "Services"
                    ? "hidden sm:inline-flex"
                    : undefined
                }
              >
                {item.label}
              </HeaderNavLink>
            ))}
          <Link
            href={bookHref}
            className="ml-1 rounded-full bg-[var(--color-brand,#2563eb)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover,#1d4ed8)] sm:px-4"
          >
            Book
          </Link>
        </nav>
      </div>
    </header>
  );
}

function HeaderNavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-2.5 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 sm:px-3",
        className,
      )}
    >
      {children}
    </Link>
  );
}
