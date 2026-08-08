import Image from "next/image";
import { Briefcase, Lock, Phone, ShieldCheck } from "lucide-react";
import type { HostSitePresence, HostingMode } from "@prisma/client";
import { hostBrandWebsite } from "@/lib/hosting";
import { hostProfileFaceUrl } from "@/lib/host-images";
import { MessageHostButton } from "@/components/message-host-form";

export type MeetYourHostProps = {
  host: {
    name: string;
    tagline?: string | null;
    description?: string | null;
    logoUrl?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    websiteUrl?: string | null;
    sitePresence?: HostSitePresence | null;
    hostingMode?: HostingMode | null;
    createdAt: Date | string;
  };
  /** Personal photo for the host face (preferred over logo) */
  profileAvatarUrl?: string | null;
  /** Confirmed / completed stays across the host brand */
  staysHosted?: number;
  /** Live listings count */
  listingCount?: number;
  /** Required to open in-app message dialog from this card */
  propertyId?: string;
  propertyTitle?: string;
  className?: string;
};

function yearsHosting(createdAt: Date | string): number {
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return 1;
  const years =
    (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(1, Math.floor(years) || 1);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * Airbnb-style full-width “Meet your host” block for listing pages.
 */
export function MeetYourHost({
  host,
  profileAvatarUrl = null,
  staysHosted = 0,
  listingCount = 0,
  propertyId,
  propertyTitle,
  className = "",
}: MeetYourHostProps) {
  const display = firstName(host.name);
  const years = yearsHosting(host.createdAt);
  const initials = host.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const faceUrl = hostProfileFaceUrl(host, profileAvatarUrl);

  const website = hostBrandWebsite({
    websiteUrl: host.websiteUrl ?? null,
    sitePresence: host.sitePresence ?? "STAYLOCAL",
    hostingMode: host.hostingMode ?? "PLATFORM",
  });

  const stats: { value: string; label: string }[] = [];
  if (staysHosted > 0) {
    stats.push({
      value: String(staysHosted),
      label: staysHosted === 1 ? "Stay hosted" : "Stays hosted",
    });
  } else if (listingCount > 0) {
    stats.push({
      value: String(listingCount),
      label: listingCount === 1 ? "Listing" : "Listings",
    });
  }
  stats.push({
    value: String(years),
    label: years === 1 ? "Year hosting" : "Years hosting",
  });

  return (
    <section
      className={className}
      aria-labelledby="meet-your-host-heading"
    >
      <h2
        id="meet-your-host-heading"
        className="text-2xl font-semibold tracking-tight text-stone-900"
      >
        Meet your host
      </h2>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
        {/* Profile card */}
        <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-[0_6px_24px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              {faceUrl ? (
                <div className="relative size-28 overflow-hidden rounded-full bg-stone-100 ring-1 ring-black/5">
                  <Image
                    src={faceUrl}
                    alt={host.name}
                    fill
                    className="object-cover"
                    sizes="112px"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex size-28 items-center justify-center rounded-full bg-bonnet text-2xl font-bold text-white ring-1 ring-black/5">
                  {initials || "H"}
                </div>
              )}
              <span
                className="absolute bottom-0.5 right-0.5 flex size-8 items-center justify-center rounded-full bg-petal0 text-white shadow-md ring-2 ring-white"
                title="Host"
              >
                <ShieldCheck className="size-4" strokeWidth={2.5} aria-hidden />
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-3xl font-semibold tracking-tight text-stone-900">
                {display}
              </p>
              <p className="mt-0.5 text-sm font-medium text-stone-500">Host</p>
            </div>
          </div>

          <dl className="mt-8 space-y-3 border-t border-stone-100 pt-6">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-stone-500">{s.label}</dt>
                <dd className="text-base font-semibold text-stone-900">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Host details */}
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-stone-900">Host details</h3>
          <ul className="mt-3 space-y-1.5 text-[15px] text-stone-700">
            {host.contactEmail ? (
              <li>Response rate: high · replies by email</li>
            ) : (
              <li>Message through Yall Come Back for the fastest reply</li>
            )}
            <li>Responds within a day</li>
            {host.tagline ? (
              <li className="text-stone-600">{host.tagline}</li>
            ) : null}
          </ul>

          {propertyId && propertyTitle ? (
            <div className="mt-6">
              <MessageHostButton
                propertyId={propertyId}
                propertyTitle={propertyTitle}
                label="Message host"
              />
            </div>
          ) : null}

          {host.description ? (
            <p className="mt-8 max-w-xl whitespace-pre-wrap text-[15px] leading-relaxed text-stone-600">
              {host.description.length > 420
                ? `${host.description.slice(0, 420).trim()}…`
                : host.description}
            </p>
          ) : null}

          <ul className="mt-6 space-y-3 text-[15px] text-stone-700">
            {website ? (
              <li className="flex items-start gap-3">
                <Briefcase
                  className="mt-0.5 size-5 shrink-0 text-stone-500"
                  aria-hidden
                />
                <span>
                  Website:{" "}
                  <a
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-stone-900 underline-offset-2 hover:underline"
                  >
                    {website.replace(/^https?:\/\//i, "")}
                  </a>
                </span>
              </li>
            ) : null}
            {host.contactPhone ? (
              <li className="flex items-start gap-3">
                <Phone
                  className="mt-0.5 size-5 shrink-0 text-stone-500"
                  aria-hidden
                />
                <span>
                  Phone:{" "}
                  <a
                    href={`tel:${host.contactPhone.replace(/\s+/g, "")}`}
                    className="font-medium text-stone-900 hover:underline"
                  >
                    {host.contactPhone}
                  </a>
                </span>
              </li>
            ) : null}
          </ul>

          <p className="mt-8 flex max-w-xl items-start gap-2.5 text-sm leading-relaxed text-stone-500">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              To help protect your payment, always book and message through
              Yall Come Back - never send money or personal payment details outside
              the platform.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
