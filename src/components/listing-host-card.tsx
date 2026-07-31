import Image from "next/image";
import type { HostSitePresence, HostingMode } from "@prisma/client";
import { hostBrandWebsite } from "@/lib/hosting";
import { MessageHostButton } from "@/components/message-host-form";

type HostInfo = {
  name: string;
  tagline?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  sitePresence?: HostSitePresence | null;
  hostingMode?: HostingMode | null;
};

/**
 * Sidebar card under Reserve - same shell as the booking widget.
 */
export function ListingHostCard({
  host,
  propertyId,
  propertyTitle,
}: {
  host: HostInfo;
  propertyId: string;
  propertyTitle: string;
}) {
  const blurb = (host.tagline || host.description || "").trim();
  const initials = host.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const website = hostBrandWebsite({
    websiteUrl: host.websiteUrl ?? null,
    sitePresence: host.sitePresence ?? "STAYLOCAL",
    hostingMode: host.hostingMode ?? "PLATFORM",
  });

  return (
    <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-lg">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        Hosted by
      </p>

      <div className="mt-3 flex items-start gap-3">
        {host.logoUrl ? (
          <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm">
            <Image
              src={host.logoUrl}
              alt={host.name}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-bonnet text-sm font-bold text-white shadow-sm">
            {initials || "H"}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-snug text-stone-900">
            {host.name}
          </p>
          {host.tagline ? (
            <p className="mt-0.5 text-sm text-stone-500">{host.tagline}</p>
          ) : null}
        </div>
      </div>

      {blurb && !host.tagline ? (
        <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-stone-600">
          {blurb}
        </p>
      ) : host.description && host.tagline ? (
        <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-stone-600">
          {host.description}
        </p>
      ) : null}

      {(host.contactEmail || host.contactPhone) && (
        <div className="mt-4 overflow-hidden rounded-xl border border-stone-300">
          {host.contactEmail ? (
            <div className="border-b border-stone-300 p-3 last:border-b-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                Email
              </p>
              <a
                href={`mailto:${host.contactEmail}`}
                className="mt-1 block truncate text-sm text-stone-900 hover:underline"
              >
                {host.contactEmail}
              </a>
            </div>
          ) : null}
          {host.contactPhone ? (
            <div className="p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                Phone
              </p>
              <a
                href={`tel:${host.contactPhone.replace(/\s+/g, "")}`}
                className="mt-1 block text-sm text-stone-900 hover:underline"
              >
                {host.contactPhone}
              </a>
            </div>
          ) : null}
        </div>
      )}

      <MessageHostButton
        propertyId={propertyId}
        propertyTitle={propertyTitle}
        label="Contact host"
        className="mt-4 w-full"
      />
      <p className="mt-2 text-center text-xs text-stone-400">
        Ask about the stay, check-in, or local tips
      </p>
      {website ? (
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-center text-sm font-medium text-bonnet hover:underline"
        >
          {website.replace(/^https?:\/\//i, "")}
        </a>
      ) : null}
    </div>
  );
}
