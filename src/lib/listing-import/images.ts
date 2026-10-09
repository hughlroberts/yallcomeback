import { randomUUID } from "crypto";
import { fetchSafeOutbound } from "@/lib/safe-url";
import {
  sniffRemoteImage,
  stripImageMetadata,
  writePublicUpload,
} from "@/lib/upload-image";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Ask for JPEG/PNG/WebP. Airbnb otherwise serves AVIF, which we cannot store. */
const IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,image/*;q=0.8";

export function isOtaCdnImageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "muscache.com" ||
      host.endsWith(".muscache.com") ||
      host === "media.expedia.com" ||
      host.endsWith(".media.expedia.com") ||
      host === "images.trvl-media.com" ||
      host.endsWith(".trvl-media.com")
    );
  } catch {
    return false;
  }
}

function listingPhotoFetchUrl(remote: string): string {
  if (!remote.includes("muscache.com") || remote.includes("im_w=")) return remote;
  return `${remote}${remote.includes("?") ? "&" : "?"}im_w=1440`;
}

function listingPhotoHeaders(remote: string): HeadersInit {
  return {
    "User-Agent": UA,
    Accept: IMAGE_ACCEPT,
    Referer: remote.includes("muscache.com")
      ? "https://www.airbnb.com/"
      : "https://www.vrbo.com/",
  };
}

/**
 * Copy remote listing photos onto this host (public/uploads/…).
 * Never returns Airbnb/VRBO CDN URLs — skip a photo if the copy fails.
 */
export async function downloadListingImages(
  propertyId: string,
  imageUrls: string[],
  max = 24,
): Promise<{ url: string; alt: string | null; sortOrder: number; isCover: boolean }[]> {
  const results: {
    url: string;
    alt: string | null;
    sortOrder: number;
    isCover: boolean;
  }[] = [];

  const limited = imageUrls.slice(0, max);
  let order = 0;

  for (const remote of limited) {
    try {
      if (
        remote.includes("/user/") ||
        remote.includes("PlatformAssets") ||
        remote.includes("/profile")
      ) {
        continue;
      }

      const res = await fetchSafeOutbound(listingPhotoFetchUrl(remote), {
        headers: listingPhotoHeaders(remote),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("image") && !ct.includes("octet-stream")) continue;

      const stripped = stripImageMetadata(Buffer.from(await res.arrayBuffer()));
      const sniffed = sniffRemoteImage(stripped);
      if (!sniffed) continue;

      const filename = `${String(order).padStart(2, "0")}-${randomUUID().slice(0, 8)}${sniffed.ext}`;
      const { publicUrl } = await writePublicUpload([propertyId], {
        bytes: stripped,
        ext: sniffed.ext,
        filename,
      });
      if (isOtaCdnImageUrl(publicUrl)) continue;

      results.push({
        url: publicUrl,
        alt: null,
        sortOrder: order,
        isCover: order === 0,
      });
      order += 1;
    } catch {
      // skip failed images — do not keep the source CDN URL
    }
  }

  return results;
}
