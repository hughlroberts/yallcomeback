import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/**
 * Download remote listing photos into public/uploads for permanent hosting.
 * Returns public paths like /uploads/{propertyId}/xxx.jpg
 */
export async function downloadListingImages(
  propertyId: string,
  imageUrls: string[],
  max = 24,
): Promise<{ url: string; alt: string | null; sortOrder: number; isCover: boolean }[]> {
  const dir = path.join(process.cwd(), "public", "uploads", propertyId);
  await mkdir(dir, { recursive: true });

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
      // Prefer larger Airbnb variants
      let fetchUrl = remote;
      if (fetchUrl.includes("muscache.com") && !fetchUrl.includes("im_w=")) {
        fetchUrl = `${remote}${remote.includes("?") ? "&" : "?"}im_w=1200`;
      }

      const res = await fetch(fetchUrl, {
        headers: { "User-Agent": UA, Accept: "image/*" },
        cache: "no-store",
        redirect: "follow",
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("image") && !ct.includes("octet-stream")) continue;

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) continue;

      const ext =
        ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      const filename = `${String(order).padStart(2, "0")}-${randomUUID().slice(0, 8)}.${ext}`;
      await writeFile(path.join(dir, filename), buf);

      results.push({
        url: `/uploads/${propertyId}/${filename}`,
        alt: null,
        sortOrder: order,
        isCover: order === 0,
      });
      order += 1;
    } catch {
      // skip failed images
    }
  }

  return results;
}
