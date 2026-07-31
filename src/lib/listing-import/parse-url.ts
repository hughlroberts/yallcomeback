import type { ImportSource } from "./types";

export function parseListingImportUrl(input: string): {
  source: ImportSource;
  sourceId: string | null;
  canonicalUrl: string;
} {
  const raw = input.trim();
  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    throw new Error("That does not look like a valid URL.");
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // Airbnb: /rooms/123 or /rooms/plus/123
  if (host === "airbnb.com" || host.endsWith(".airbnb.com")) {
    const m = url.pathname.match(/\/rooms(?:\/plus)?\/(\d+)/i);
    const id = m?.[1] ?? null;
    return {
      source: "airbnb",
      sourceId: id,
      canonicalUrl: id
        ? `https://www.airbnb.com/rooms/${id}`
        : url.toString(),
    };
  }

  // VRBO / Expedia vacation rentals
  if (
    host === "vrbo.com" ||
    host.endsWith(".vrbo.com") ||
    host === "abritel.fr" ||
    host.includes("vacationrentals")
  ) {
    // /p123456 or /cabin/.../p123 or query
    const m =
      url.pathname.match(/\/p(\d+)/i) ||
      url.pathname.match(/\.(\d{6,})/) ||
      url.pathname.match(/\/(\d{6,})(?:\/|$)/);
    const id = m?.[1] ?? null;
    return {
      source: "vrbo",
      sourceId: id,
      canonicalUrl: url.origin + url.pathname,
    };
  }

  return {
    source: "unknown",
    sourceId: null,
    canonicalUrl: url.toString(),
  };
}
