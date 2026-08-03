import Link from "next/link";
import type { Host } from "@prisma/client";

type Props = {
  host: Pick<Host, "name" | "slug" | "sitePublishState" | "websiteUrl">;
  /** True when the current viewer is host admin / platform (private preview). */
  isOwnerPreview?: boolean;
};

/**
 * Shown on DEMO (public preview before domain cutover) and on UNPUBLISHED
 * owner-only previews so hosts know this is not production yet.
 */
export function HostSiteDemoBanner({ host, isOwnerPreview }: Props) {
  if (host.sitePublishState === "LIVE") return null;

  if (host.sitePublishState === "UNPUBLISHED") {
    if (!isOwnerPreview) return null;
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-950">
        <strong className="font-semibold">Private preview</strong>
        {" — "}
        Guests cannot see this site yet. Publish to{" "}
        <strong>Demo</strong> from{" "}
        <Link
          href="/admin/brand"
          className="font-semibold underline underline-offset-2"
        >
          Brand &amp; website
        </Link>{" "}
        when you&apos;re ready for a shareable preview.
      </div>
    );
  }

  // DEMO
  return (
    <div className="border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-sm text-sky-950">
      <strong className="font-semibold">Demo site</strong>
      {" — "}
      This is a public preview of {host.name}. Point your domain here when you
      go live
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
      .{" "}
      <Link
        href="/admin/brand"
        className="font-semibold underline underline-offset-2"
      >
        Manage publish status
      </Link>
    </div>
  );
}
