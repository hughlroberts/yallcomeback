/** Keep branded guest navigation explicit; never infer a tenant from a foreign listing. */
export function guestFlowPath(hostSlug: string | null | undefined, path: string): string {
  return hostSlug ? `/h/${encodeURIComponent(hostSlug)}${path}` : path;
}

export function sameBrand(tenantSlug: string | null | undefined, listingHostSlug: string): boolean {
  return !tenantSlug || tenantSlug === listingHostSlug;
}
