import { headers } from "next/headers";
import type { CSSProperties } from "react";
import type { Host } from "@prisma/client";
import { getHostForGuestSite } from "@/lib/host";
import { TENANT_SLUG_HEADER } from "@/lib/tenant-constants";

export type HostTenant = Host;

/** Re-export for server modules; Edge middleware imports tenant-constants instead. */
export { TENANT_SLUG_HEADER };

/**
 * Resolve the public host brand for this request.
 * Only trusts the middleware `x-tenant-slug` header so /admin, /login, etc.
 * on a custom domain still get platform chrome (hosts manage ops as YCB tools).
 *
 * Uses guest-site visibility: DEMO/LIVE public; UNPUBLISHED only for host admin preview.
 *
 * Safe during build/static generation: returns null if headers() is unavailable
 * (e.g. opengraph-image collect at build time).
 */
export async function getRequestTenant(): Promise<HostTenant | null> {
  try {
    const h = await headers();
    const fromHeader = h.get(TENANT_SLUG_HEADER)?.trim().toLowerCase();
    if (!fromHeader) return null;
    return getHostForGuestSite(fromHeader);
  } catch {
    // Build-time / generateStaticParams — no request context
    return null;
  }
}

/**
 * CSS custom properties so host primary color remaps bonnet/brand tokens
 * used across the guest chrome (buttons, links, active nav).
 */
export function hostBrandStyle(
  host: Pick<Host, "primaryColor">,
): CSSProperties {
  const primary = normalizeHex(host.primaryColor) || "#2563eb";
  const hover = darkenHex(primary, 0.12);
  const active = darkenHex(primary, 0.22);
  const soft = mixWithWhite(primary, 0.88);
  const softHover = mixWithWhite(primary, 0.82);

  return {
    ["--color-brand" as string]: primary,
    ["--color-brand-hover" as string]: hover,
    ["--color-brand-active" as string]: active,
    ["--color-soft" as string]: soft,
    ["--color-soft-hover" as string]: softHover,
    ["--color-focus" as string]: primary,
    ["--color-bonnet" as string]: primary,
    ["--color-bonnet-hover" as string]: hover,
    ["--color-bonnet-active" as string]: active,
    ["--color-petal" as string]: soft,
    ["--color-petal-hover" as string]: softHover,
    ["--primary" as string]: primary,
    ["--primary-hover" as string]: hover,
    ["--primary-soft" as string]: soft,
    ["--ring" as string]: primary,
  };
}

function normalizeHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function darkenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - amount;
  return rgbToHex(r * f, g * f, b * f);
}

function mixWithWhite(hex: string, whiteWeight: number): string {
  const { r, g, b } = hexToRgb(hex);
  const w = whiteWeight;
  return rgbToHex(
    r * (1 - w) + 255 * w,
    g * (1 - w) + 255 * w,
    b * (1 - w) + 255 * w,
  );
}
