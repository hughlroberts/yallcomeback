"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import {
  ensureHostAccess,
  resolveHostIdForCreate,
} from "@/lib/scope";
import { fetchListingFromUrl } from "@/lib/listing-import/fetch";
import { downloadListingImages } from "@/lib/listing-import/images";
import type { ImportedListingDraft } from "@/lib/listing-import/types";

export type ListingImportPreview = ImportedListingDraft & {
  previewOk: true;
};

export async function previewListingImport(formData: FormData): Promise<
  | ListingImportPreview
  | { previewOk: false; error: string }
> {
  try {
    await ensureHostAccess();
    const url = String(formData.get("url") || "").trim();
    if (!url) return { previewOk: false, error: "Paste an Airbnb or VRBO URL." };
    const draft = await fetchListingFromUrl(url);
    return { ...draft, previewOk: true };
  } catch (e) {
    return {
      previewOk: false,
      error: e instanceof Error ? e.message : "Import failed.",
    };
  }
}

export type ImportListingResult =
  | { ok: true; propertyId: string; photoCount: number }
  | { ok: false; error: string };

/**
 * Import agent: fetch OTA listing → create draft property → download photos.
 * Returns a result object (no redirect) so the client can navigate reliably.
 */
export async function importListingFromUrl(
  formData: FormData,
): Promise<ImportListingResult> {
  try {
    const access = await ensureHostAccess();
    const hostId = await resolveHostIdForCreate(access, formData);
    const url = String(formData.get("url") || "").trim();
    if (!url) return { ok: false, error: "URL required" };

    const draft = await fetchListingFromUrl(url);
    const host = await prisma.host.findUniqueOrThrow({ where: { id: hostId } });

    let slug = slugify(draft.title);
    if (!slug) slug = `listing-${Date.now().toString(36)}`;
    const clash = await prisma.property.findFirst({ where: { hostId, slug } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const baseNightlyRate = Number(
      formData.get("baseNightlyRate") || draft.baseNightlyRate || 150,
    );

    const sourceNote = [
      `Imported from ${draft.source.toUpperCase()}`,
      draft.sourceUrl,
      draft.sourceId ? `ID ${draft.sourceId}` : null,
      ...draft.rawNotes,
    ]
      .filter(Boolean)
      .join("\n");

    const property = await prisma.property.create({
      data: {
        hostId,
        title: draft.title,
        slug,
        tagline: draft.tagline,
        description: draft.description
          ? `${draft.description}\n\n—\n${sourceNote}`
          : sourceNote,
        propertyType: draft.propertyType,
        city: draft.city,
        region: draft.region,
        country: draft.country || "United States",
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        beds: draft.beds,
        maxGuests: draft.maxGuests,
        baseNightlyRate: Number.isFinite(baseNightlyRate) ? baseNightlyRate : 150,
        defaultMinNights: 2,
        cleaningFee: 0,
        petFee: 0,
        petsAllowed: draft.amenities.some((a) =>
          a.toLowerCase().includes("pet"),
        ),
        depositPercent: 30,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        amenities: JSON.stringify(draft.amenities),
        houseRules: draft.houseRules,
        published: false,
        listOnMarketplace: host.listOnMarketplace,
        featured: false,
      },
    });

    await prisma.icalConnection.create({
      data: {
        propertyId: property.id,
        name: "Export feed",
        enabled: true,
      },
    });

    // Photos: try download to /uploads; fall back to remote CDN URLs (needed on
    // ephemeral hosts like Railway when local disk is not durable).
    const downloaded = await downloadListingImages(
      property.id,
      draft.imageUrls,
      24,
    );
    const imageRows =
      downloaded.length > 0
        ? downloaded.map((img) => ({
            propertyId: property.id,
            url: img.url,
            alt: draft.title,
            sortOrder: img.sortOrder,
            isCover: img.isCover,
          }))
        : draft.imageUrls
            .filter((u) => !u.includes("/user/") && !u.includes("PlatformAssets"))
            .slice(0, 24)
            .map((remoteUrl, i) => ({
              propertyId: property.id,
              url:
                remoteUrl.includes("muscache.com") && !remoteUrl.includes("im_w=")
                  ? `${remoteUrl}${remoteUrl.includes("?") ? "&" : "?"}im_w=1200`
                  : remoteUrl,
              alt: draft.title,
              sortOrder: i,
              isCover: i === 0,
            }));

    if (imageRows.length > 0) {
      await prisma.propertyImage.createMany({ data: imageRows });
    }

    revalidatePath("/admin/properties");
    revalidatePath(`/admin/properties/${property.id}`);

    return {
      ok: true,
      propertyId: property.id,
      photoCount: imageRows.length,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Import failed.",
    };
  }
}
