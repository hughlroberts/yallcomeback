import { prisma } from "@/lib/db";
import { isStripeConfigured } from "@/lib/stripe";
import {
  marketplaceCardState,
  marketplaceNeedsCard,
  type MarketplaceCardState,
} from "@/lib/marketplace-billing-plan";
import { MarketplaceCardBanner } from "@/components/marketplace-card-banner";

type NoticeData = {
  hostId: string;
  hostName: string;
  state: MarketplaceCardState;
  unitUsd: number | null;
};

/** Loads the brand with its plan and starts the 14-day grace on first view. */
async function loadNotice(hostId: string): Promise<NoticeData | null> {
  try {
    let host = await prisma.host.findUnique({
      where: { id: hostId },
      include: { plan: true },
    });
    if (!host || !marketplaceNeedsCard(host)) return null;
    if (!host.marketplaceGraceEndsAt) {
      const { ensureMarketplaceGrace } = await import(
        "@/lib/marketplace-billing"
      );
      const endsAt = await ensureMarketplaceGrace(host);
      host = { ...host, marketplaceGraceEndsAt: endsAt };
    }
    const state = marketplaceCardState(host);
    if (state.kind !== "grace" && state.kind !== "suspended") return null;
    return {
      hostId: host.id,
      hostName: host.name,
      state,
      unitUsd: host.plan?.monthlyPrice ?? null,
    };
  } catch {
    // A banner must never break the admin page.
    return null;
  }
}

/**
 * T45: server wrapper for the Marketplace "Add card" banner on admin pages.
 * $0 complimentary brands never see it.
 */
export async function MarketplaceCardNotice({
  hostId,
  className,
}: {
  hostId: string | null | undefined;
  className?: string;
}) {
  if (!hostId || !isStripeConfigured()) return null;
  const data = await loadNotice(hostId);
  if (!data) return null;
  return (
    <div className={className}>
      <MarketplaceCardBanner {...data} />
    </div>
  );
}
