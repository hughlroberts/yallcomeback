import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireHostAdmin } from "@/lib/auth";
import { assertPropertyAccess } from "@/lib/scope";
import { getSiteOrigin, listingPublicPath } from "@/lib/site-url";
import {
  FridgeMagnet,
  MAGNET_PRINT_CSS,
} from "@/components/fridge-magnet";
import { PrintMagnetButton } from "@/components/print-magnet-button";

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
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/magnets");

  const { propertyId } = await params;
  try {
    await assertPropertyAccess(propertyId, access);
  } catch {
    notFound();
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      host: { select: { name: true, slug: true } },
    },
  });
  if (!property) notFound();

  const origin = await getSiteOrigin();
  const path = listingPublicPath(property.slug, property.host.slug);
  const listingUrl = `${origin}${path}`;

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

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Yall Come Back";

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

      <FridgeMagnet
        propertyTitle={property.title}
        hostName={property.host.name}
        listingUrl={listingUrl}
        qrSvg={qrSvg}
        siteName={siteName}
      />

      <p className="no-print mt-4 text-center text-xs text-slate-400">
        QR opens: {listingUrl}
      </p>
    </div>
  );
}
