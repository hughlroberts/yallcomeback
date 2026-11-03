/**
 * T45: after a listing change (publish, pause, archive, restore, delete,
 * rename), update the brand's Marketplace card subscription items for the
 * NEXT bill (no proration). Fire-and-forget: never blocks or fails a save.
 * Brands that are not on a Marketplace card subscription are skipped.
 */
export function queueListingBillingSync(hostId: string | null | undefined): void {
  if (!hostId) return;
  void import("@/lib/marketplace-billing")
    .then((m) => m.queueMarketplaceBillingSync(hostId))
    .catch(() => null);
}
