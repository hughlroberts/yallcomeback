import { SUBSCRIBE_CHECKOUT_LABEL } from "@/lib/billing-labels";
import {
  brandListingsHidden,
  type BrandVisibilityFields,
} from "@/lib/brand-visibility";

/**
 * K2: /admin/brand must not claim the /h/ demo is live for guests when
 * the add-card window has ended (getHostForGuestSite 404s for the public).
 */
export function adminBrandDemoSiteCopy(
  host: { slug: string } & BrandVisibilityFields,
): { hidden: boolean; text: string } {
  const path = `/h/${host.slug}`;
  if (brandListingsHidden(host)) {
    return {
      hidden: true,
      text: `The ${path} demo site is included on every plan, including Marketplace only, but it is not live for guests. The 14 days to add a card ended, so guests cannot open the demo or find your listings on Find a Place. Select ${SUBSCRIBE_CHECKOUT_LABEL} to show them again.`,
    };
  }
  return {
    hidden: false,
    text: `A branded demo site at ${path} is included on every plan, including Marketplace only — you can build it without upgrading.`,
  };
}
