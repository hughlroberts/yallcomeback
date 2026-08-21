import Image from "next/image";
import Link from "next/link";
import type { Host } from "@prisma/client";
import { MessageHostButton } from "@/components/message-host-form";
import { hostSiteMarkObjectFit, hostSiteMarkUrl } from "@/lib/host-images";
import { hostSocialLinks } from "@/lib/host-site";

type Props = {
  host: Pick<
    Host,
    | "id"
    | "name"
    | "slug"
    | "logoUrl"
    | "tagline"
    | "contactEmail"
    | "contactPhone"
    | "websiteUrl"
    | "siteAddress"
    | "sitePageAbout"
    | "sitePageServices"
    | "siteServicesTitle"
    | "siteServicesPath"
    | "socialFacebook"
    | "socialX"
    | "socialInstagram"
    | "socialTiktok"
  >;
  profileAvatarUrl?: string | null;
  /** Empty on custom domain; `/h/slug` when previewing on the platform. */
  basePath?: string;
};

/**
 * Host-owned footer: brand + contact (address/phone/email) + message + socials.
 * Page links live in the header / hero (not duplicated under Explore).
 */
export function HostSiteFooter({
  host,
  profileAvatarUrl = null,
  basePath = "",
}: Props) {
  const socials = hostSocialLinks(host);
  const markUrl = hostSiteMarkUrl(host, profileAvatarUrl);
  const markIsLogo = Boolean(host.logoUrl?.trim());
  const markFit = hostSiteMarkObjectFit(host);
  const hasDirectContact = Boolean(
    host.siteAddress || host.contactPhone || host.contactEmail,
  );

  return (
    <footer className="mt-auto border-t border-stone-200 bg-stone-50 pb-[env(safe-area-inset-bottom,0px)] text-stone-700">
      {/* Tighter vertical padding so a larger mark doesn’t grow the footer */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-7">
        <div className="grid gap-8 sm:grid-cols-2 sm:items-center">
          <div className="flex flex-row items-center gap-4">
            {markUrl ? (
              <span
                className={
                  markIsLogo
                    ? "relative size-28 shrink-0"
                    : "relative size-28 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200"
                }
              >
                <Image
                  src={markUrl}
                  alt=""
                  fill
                  className={
                    markIsLogo || markFit === "contain"
                      ? "object-contain"
                      : "object-cover"
                  }
                  sizes="112px"
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
              Contact
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {host.siteAddress ? (
                <li className="whitespace-pre-line text-stone-600">
                  {host.siteAddress}
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
              <li>
                <MessageHostButton
                  hostId={host.id}
                  hostName={host.name}
                  label="Send a message"
                  variant="link"
                  defaultSubject={`Question for ${host.name}`}
                  className="font-medium"
                />
              </li>
              {!hasDirectContact && host.sitePageAbout ? (
                <li className="text-stone-500">
                  <Link
                    href={`${basePath}/about#contact` || "/about#contact"}
                    className="hover:text-[var(--color-brand)]"
                  >
                    More contact options →
                  </Link>
                </li>
              ) : null}
            </ul>

            {socials.length > 0 ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-400">
                  Follow
                </p>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {socials.map((s) => (
                    <li key={s.network}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-stone-700 hover:text-[var(--color-brand)]"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
