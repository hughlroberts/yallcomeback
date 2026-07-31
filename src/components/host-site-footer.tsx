import Image from "next/image";
import Link from "next/link";
import type { Host } from "@prisma/client";

type Props = {
  host: Pick<
    Host,
    | "name"
    | "slug"
    | "logoUrl"
    | "tagline"
    | "contactEmail"
    | "contactPhone"
    | "websiteUrl"
  >;
  /** Empty on custom domain; `/h/slug` when previewing on the platform. */
  basePath?: string;
};

/**
 * Host-owned footer. Guest relationship is with the host brand.
 * Tiny “Powered by” keeps stack credit without stealing the customer.
 */
export function HostSiteFooter({ host, basePath = "" }: Props) {
  const about = `${basePath}/about` || "/about";
  const contact = `${basePath}/contact` || "/contact";
  const stays = `${basePath}/stays` || "/stays";
  const home = basePath || "/";

  return (
    <footer className="mt-auto border-t border-stone-200 bg-stone-50 pb-[env(safe-area-inset-bottom,0px)] text-stone-700">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-row items-start gap-4 sm:col-span-2 lg:col-span-1">
            {host.logoUrl ? (
              <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-stone-200">
                <Image
                  src={host.logoUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="56px"
                  unoptimized
                />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="font-display text-xl font-medium tracking-tight text-stone-900">
                {host.name}
              </p>
              {host.tagline ? (
                <p className="mt-1 text-sm text-stone-500">{host.tagline}</p>
              ) : (
                <p className="mt-1 text-sm text-stone-500">
                  Book direct with your host — not a marketplace middleman.
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-400">
              Explore
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href={home} className="hover:text-[var(--color-brand)]">
                  Home
                </Link>
              </li>
              <li>
                <Link href={stays} className="hover:text-[var(--color-brand)]">
                  Stays
                </Link>
              </li>
              <li>
                <Link href={about} className="hover:text-[var(--color-brand)]">
                  About
                </Link>
              </li>
              <li>
                <Link
                  href={contact}
                  className="hover:text-[var(--color-brand)]"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-400">
              Contact
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {host.contactEmail ? (
                <li>
                  <a
                    href={`mailto:${host.contactEmail}`}
                    className="hover:text-[var(--color-brand)]"
                  >
                    {host.contactEmail}
                  </a>
                </li>
              ) : null}
              {host.contactPhone ? (
                <li>
                  <a
                    href={`tel:${host.contactPhone.replace(/\s+/g, "")}`}
                    className="hover:text-[var(--color-brand)]"
                  >
                    {host.contactPhone}
                  </a>
                </li>
              ) : null}
              {!host.contactEmail && !host.contactPhone ? (
                <li className="text-stone-500">
                  <Link
                    href={contact}
                    className="hover:text-[var(--color-brand)]"
                  >
                    Get in touch →
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-stone-200/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-stone-400 sm:px-6">
          <p>
            © {new Date().getFullYear()} {host.name}
          </p>
          <p>
            Powered by{" "}
            <a
              href="https://yallcomeback.com"
              className="underline-offset-2 hover:text-stone-600 hover:underline"
              rel="noopener noreferrer"
            >
              Yall Come Back
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
