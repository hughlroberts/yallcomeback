import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireHostAdmin } from "@/lib/auth";
import { assertPropertyAccess } from "@/lib/scope";
import {
  getSiteOrigin,
  magnetListingUrl,
  parseMagnetLinkTarget,
  type MagnetLinkTarget,
} from "@/lib/site-url";
import {
  FridgeMagnet,
  MAGNET_PRINT_CSS,
} from "@/components/fridge-magnet";
import { PrintMagnetButton } from "@/components/print-magnet-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { title: true },
  });
  return {
    title: property
      ? `Print magnet · ${property.title}`
      : "Print magnet · Admin",
  };
}

export default async function AdminMagnetPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ link?: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/magnets");

  const { propertyId } = await params;
  const sp = await searchParams;
  try {
    await assertPropertyAccess(propertyId, access);
  } catch {
    notFound();
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      host: {
        select: {
          name: true,
          slug: true,
          websiteUrl: true,
          logoUrl: true,
        },
      },
    },
  });
  if (!property) notFound();

  const hasHostWebsite = Boolean(property.host.websiteUrl?.trim());
  // Default: host site when they have one (they own the guest); else YCB marketplace
  const requested = parseMagnetLinkTarget(sp.link);
  const linkTarget: MagnetLinkTarget =
    requested === "host" || (sp.link == null && hasHostWebsite)
      ? "host"
      : "marketplace";
  // If they asked for host but have no website, still use /h/… host path
  const effectiveTarget: MagnetLinkTarget =
    linkTarget === "host" ? "host" : "marketplace";

  const platformOrigin = await getSiteOrigin();
  const listingUrl = magnetListingUrl({
    target: effectiveTarget,
    platformOrigin,
    propertySlug: property.slug,
    hostSlug: property.host.slug,
    hostWebsiteUrl: property.host.websiteUrl,
  });

  const qrSvg = await QRCode.toString(listingUrl, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
    width: 512,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  const platformName = process.env.NEXT_PUBLIC_SITE_NAME || "Yall Come Back";
  const siteName =
    effectiveTarget === "host" ? property.host.name : platformName;
  const brandMarkSrc =
    effectiveTarget === "host" && property.host.logoUrl
      ? property.host.logoUrl
      : "/brand/ycb-seal.svg";

  const basePath = `/admin/magnets/${property.id}`;

  return (
    <div id="print-magnet-wrap">
      <style dangerouslySetInnerHTML={{ __html: MAGNET_PRINT_CSS }} />

      <div className="no-print mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            <Link
              href="/admin/magnets"
              className="font-medium text-bonnet hover:underline"
            >
              ← Fridge magnets
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Print preview
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            This prints as <strong>exactly one letter page</strong>. Use your
            browser print dialog — leave scale at 100% and avoid “headers and
            footers” if your browser offers that option.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintMagnetButton />
          <Link
            href={`/admin/properties/${property.id}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Edit listing
          </Link>
        </div>
      </div>

      {/* Host chooses where the QR sends guests */}
      <div className="no-print mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-semibold text-slate-900">
          Where should the QR code open?
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Pick before you print. Guests who scan will book through that site —
          so you choose whether they land on <strong>your</strong> website or
          Yall Come Back.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <LinkTargetCard
            href={`${basePath}?link=host`}
            selected={effectiveTarget === "host"}
            title="Your website"
            description={
              hasHostWebsite
                ? `Opens on ${displayHost(property.host.websiteUrl!)} — you own the guest relationship.`
                : "Uses your host site path on this app. Add a custom domain under Brand & website for a full vanity URL."
            }
            badge={hasHostWebsite ? "Recommended" : "Host path"}
          />
          <LinkTargetCard
            href={`${basePath}?link=marketplace`}
            selected={effectiveTarget === "marketplace"}
            title="Yall Come Back"
            description="Opens the listing on the Yall Come Back marketplace (shared discovery)."
            badge="Marketplace"
          />
        </div>
        {!hasHostWebsite && effectiveTarget === "host" ? (
          <p className="mt-3 text-xs text-slate-500">
            Tip: set your website under{" "}
            <Link href="/admin/brand" className="font-medium text-bonnet hover:underline">
              Brand & website
            </Link>{" "}
            so the QR uses your real domain (e.g. cherokeelanding.net).
          </p>
        ) : null}
      </div>

      <FridgeMagnet
        propertyTitle={property.title}
        hostName={property.host.name}
        listingUrl={listingUrl}
        qrSvg={qrSvg}
        siteName={siteName}
        brandMarkSrc={brandMarkSrc}
      />

      <p className="no-print mt-4 text-center text-xs text-slate-400">
        QR opens ({effectiveTarget === "host" ? "your site" : "Yall Come Back"}
        ): {listingUrl}
      </p>
    </div>
  );
}

function displayHost(url: string): string {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    return u.host;
  } catch {
    return url;
  }
}

function LinkTargetCard({
  href,
  selected,
  title,
  description,
  badge,
}: {
  href: string;
  selected: boolean;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border p-4 transition",
        selected
          ? "border-bonnet bg-petal ring-1 ring-bonnet/30"
          : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white",
      )}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-900">{title}</p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            selected
              ? "bg-bonnet text-white"
              : "bg-slate-200 text-slate-600",
          )}
        >
          {badge}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        {description}
      </p>
      {selected ? (
        <p className="mt-2 text-xs font-semibold text-bonnet">Selected · QR uses this</p>
      ) : (
        <p className="mt-2 text-xs font-medium text-slate-400">Click to select</p>
      )}
    </Link>
  );
}
