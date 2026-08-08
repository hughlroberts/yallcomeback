import Link from "next/link";
import type { Host } from "@prisma/client";

type Props = {
  host: Pick<
    Host,
    | "id"
    | "name"
    | "slug"
    | "sitePublishState"
    | "websiteUrl"
    | "sitePageAbout"
    | "sitePageServices"
  >;
  /** True when the current viewer is host admin / platform (private preview). */
  isOwnerPreview?: boolean;
  /** Platform admin: deep-link brand editor with hostId */
  isPlatformAdmin?: boolean;
};

/**
 * Shown on DEMO (public preview before domain cutover) and on UNPUBLISHED
 * owner-only previews so hosts know this is not production yet.
 * Owners also get quick links to edit pages (e.g. boat rentals services).
 */
export function HostSiteDemoBanner({
  host,
  isOwnerPreview,
  isPlatformAdmin,
}: Props) {
  if (host.sitePublishState === "LIVE") {
    if (!isOwnerPreview) return null;
    // Live but still show compact owner edit bar
    return (
      <div className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-center text-sm text-stone-700">
        <strong className="font-semibold">You&apos;re editing this site</strong>
        {" · "}
        <OwnerEditLinks
          host={host}
          isPlatformAdmin={isPlatformAdmin}
        />
      </div>
    );
  }

  const brandHref = isPlatformAdmin
    ? `/admin/brand?hostId=${host.id}`
    : "/admin/brand";

  if (host.sitePublishState === "UNPUBLISHED") {
    if (!isOwnerPreview) return null;
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-950">
        <strong className="font-semibold">Private preview</strong>
        {" — "}
        Guests cannot see this site yet.{" "}
        <Link
          href={brandHref}
          className="font-semibold underline underline-offset-2"
        >
          Brand &amp; website
        </Link>
        {" · "}
        <OwnerEditLinks host={host} isPlatformAdmin={isPlatformAdmin} />
      </div>
    );
  }

  // DEMO
  return (
    <div className="border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-sm text-sky-950">
      <p>
        <strong className="font-semibold">Demo site</strong>
        {" — "}
        Public preview of {host.name}
        {host.websiteUrl ? (
          <>
            {" "}
            (
            <span className="font-medium">
              {host.websiteUrl.replace(/^https?:\/\//, "")}
            </span>
            )
          </>
        ) : null}
        .
      </p>
      {isOwnerPreview ? (
        <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-sm">
          <OwnerEditLinks host={host} isPlatformAdmin={isPlatformAdmin} />
          <Link
            href={brandHref}
            className="font-semibold underline underline-offset-2"
          >
            Publish status
          </Link>
        </p>
      ) : (
        <p className="mt-1 text-xs text-sky-900/80">
          Point your domain here when you go live.
        </p>
      )}
    </div>
  );
}

function OwnerEditLinks({
  host,
  isPlatformAdmin,
}: {
  host: Pick<
    Host,
    "id" | "slug" | "sitePageAbout" | "sitePageServices"
  >;
  isPlatformAdmin?: boolean;
}) {
  const brand = isPlatformAdmin
    ? `/admin/brand?hostId=${host.id}`
    : "/admin/brand";
  const services = `${brand}#services-builder`;

  return (
    <>
      <Link
        href={brand}
        className="font-semibold underline underline-offset-2"
      >
        Edit website
      </Link>
      {host.sitePageServices ? (
        <Link
          href={services}
          className="font-semibold underline underline-offset-2"
        >
          Edit Other services (boat rentals, etc.)
        </Link>
      ) : (
        <Link
          href={`${brand}#pages`}
          className="font-semibold underline underline-offset-2"
        >
          Add Other services page
        </Link>
      )}
      {host.sitePageAbout ? (
        <Link
          href={`/h/${host.slug}/about`}
          className="font-medium text-sky-900/80 underline-offset-2 hover:underline"
        >
          View About
        </Link>
      ) : null}
    </>
  );
}
