import Image from "next/image";
import Link from "next/link";
import type { Host } from "@prisma/client";
import { cn } from "@/lib/utils";
import { hostSiteNavItems } from "@/lib/host-site";
import { hostSiteMarkObjectFit, hostSiteMarkUrl } from "@/lib/host-images";

type Props = {
  host: Pick<
    Host,
    | "name"
    | "slug"
    | "logoUrl"
    | "tagline"
    | "sitePageAbout"
    | "sitePageServices"
    | "siteServicesTitle"
    | "siteServicesPath"
  >;
  /** Owner/profile photo when no brand logo is set */
  profileAvatarUrl?: string | null;
  /** Public paths on custom domain are root-relative (/about); on platform use /h/slug */
  basePath?: string;
};

/**
 * Guest chrome for a host-owned site (custom domain or /h/[slug]).
 * Fixed nav: Stays, About, Services (custom label), Book.
 * Mark: brand logo if set, otherwise host profile photo.
 */
export function HostSiteHeader({
  host,
  profileAvatarUrl = null,
  basePath = "",
}: Props) {
  const home = basePath || "/";
  const nav = hostSiteNavItems(host, basePath).filter((item) => !item.primary);
  const bookHref = basePath ? `${basePath}/stays` : "/stays";
  const markUrl = hostSiteMarkUrl(host, profileAvatarUrl);
  const markIsLogo = Boolean(host.logoUrl?.trim());
  const markFit = hostSiteMarkObjectFit(host);

  return (
    <header className="sticky top-0 z-[200] border-b border-stone-200/80 bg-white/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:min-h-16 sm:gap-3 sm:px-6 sm:py-2.5 md:min-h-[4.5rem]">
        <Link
          href={home}
          className="flex min-w-0 items-center gap-2 sm:gap-3"
          aria-label={`${host.name}, home`}
        >
          {markUrl ? (
            <span
              className={cn(
                "relative size-9 shrink-0 overflow-hidden ring-1 ring-stone-200/80 sm:size-12",
                markIsLogo
                  ? "rounded-full bg-white"
                  : "rounded-full bg-stone-100",
              )}
            >
              <Image
                src={markUrl}
                alt=""
                fill
                className={markFit === "contain" ? "object-contain p-0.5" : "object-cover"}
                sizes="48px"
                priority
                unoptimized
              />
            </span>
          ) : (
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand,#2563eb)] text-sm font-semibold text-white sm:size-12 sm:text-base"
              aria-hidden
            >
              {host.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-medium tracking-tight text-stone-900 sm:text-xl">
              {host.name}
            </span>
            {host.tagline ? (
              <span className="hidden truncate text-xs text-stone-500 sm:block">
                {host.tagline}
              </span>
            ) : null}
          </span>
        </Link>

        <nav
          className="flex max-w-[55%] shrink-0 flex-wrap items-center justify-end gap-0.5 sm:max-w-none sm:gap-1"
          aria-label="Site"
        >
          {nav.map((item) => (
            <HeaderNavLink key={item.href} href={item.href}>
              {item.label}
            </HeaderNavLink>
          ))}
          <Link
            href={bookHref}
            className="ml-0.5 rounded-full bg-[var(--color-brand,#2563eb)] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover,#1d4ed8)] sm:ml-1 sm:px-4 sm:text-sm"
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
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-2 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 sm:px-3 sm:text-sm",
      )}
    >
      {children}
    </Link>
  );
}
