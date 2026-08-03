import { prisma } from "@/lib/db";
import {
  extractQualitySignals,
  FAIR_PEER_SCORE_MAX,
  milesBetween,
  peerMismatchScore,
  SOFT_PEER_SCORE_MAX,
} from "./location-quality";
import type {
  CollectorBundle,
  ExternalSignalNote,
  HitlMemory,
  InternalListingStats,
  PeerComp,
} from "./types";

/**
 * Data Collector agent (platform-only).
 * Peers balanced by capacity + location tier + amenities (pool/dock) + proximity.
 * Loads prior HITL feedback to tighten matching next cycle.
 */
export async function collectHostPricingData(
  hostId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<CollectorBundle> {
  const host = await prisma.host.findUniqueOrThrow({
    where: { id: hostId },
    select: { id: true, name: true, slug: true },
  });

  const properties = await prisma.property.findMany({
    where: { hostId },
    orderBy: { title: "asc" },
  });

  const bookings = await prisma.booking.findMany({
    where: {
      property: { hostId },
      createdAt: { gte: periodStart, lte: periodEnd },
      status: { in: ["CONFIRMED", "COMPLETED", "PENDING_PAYMENT"] },
    },
    select: {
      propertyId: true,
      status: true,
      nights: true,
      totalAmount: true,
      checkIn: true,
      createdAt: true,
    },
  });

  const hitl = await loadHitlMemory(hostId);

  const windowDays = Math.max(
    1,
    Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000),
  );

  const listings: InternalListingStats[] = properties.map((p) => {
    const pb = bookings.filter((b) => b.propertyId === p.id);
    const confirmed = pb.filter(
      (b) => b.status === "CONFIRMED" || b.status === "COMPLETED",
    );
    const nights = confirmed.reduce((s, b) => s + b.nights, 0);
    const revenue = confirmed.reduce((s, b) => s + b.totalAmount, 0);
    const leadTimes = confirmed
      .map((b) =>
        Math.round((b.checkIn.getTime() - b.createdAt.getTime()) / 86400000),
      )
      .filter((d) => d >= 0 && d < 400);
    const avgLead =
      leadTimes.length > 0
        ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
        : null;

    const quality = extractQualitySignals({
      amenitiesJson: p.amenities,
      title: p.title,
      description: p.description,
      tagline: p.tagline,
    });

    return {
      propertyId: p.id,
      slug: p.slug,
      title: p.title,
      city: p.city,
      region: p.region,
      maxGuests: p.maxGuests,
      bedrooms: p.bedrooms,
      baseNightlyRate: p.baseNightlyRate,
      published: p.published,
      listOnMarketplace: p.listOnMarketplace,
      bookingCount90d: pb.length,
      confirmedNights90d: nights,
      revenue90d: revenue,
      occupancyEstimate90d: Math.min(1, nights / windowDays),
      avgLeadTimeDays: avgLead,
      latitude: p.latitude,
      longitude: p.longitude,
      quality,
    };
  });

  // Private PricingMarketComp rows (never public) + optional real marketplace peers.
  // Guest UI never reads PricingMarketComp; marketplace queries exclude proxy hosts.
  const { MARKETPLACE_EXCLUDED_HOST_SLUGS } = await import("@/lib/host");

  const privateComps = await prisma.pricingMarketComp.findMany({
    where: { active: true },
    take: 200,
  });

  const peerCompsByPropertyId: Record<string, PeerComp[]> = {};
  for (const listing of listings) {
    type Candidate = {
      id: string;
      title: string;
      tagline: string | null;
      description: string | null;
      amenities: string | null;
      maxGuests: number;
      bedrooms: number;
      baseNightlyRate: number;
      city: string | null;
      region: string | null;
      latitude: number | null;
      longitude: number | null;
      privateProxy: boolean;
    };

    const fromPrivate: Candidate[] = privateComps
      .filter(
        (c) =>
          c.maxGuests >= Math.max(1, listing.maxGuests - 2) &&
          c.maxGuests <= listing.maxGuests + 2,
      )
      .map((c) => ({
        id: `comp:${c.id}`,
        title: c.title,
        tagline: c.tagline,
        description: c.description,
        amenities: c.amenitiesJson,
        maxGuests: c.maxGuests,
        bedrooms: c.bedrooms,
        baseNightlyRate: c.baseNightlyRate,
        city: c.city,
        region: c.region,
        latitude: c.latitude,
        longitude: c.longitude,
        privateProxy: true,
      }));

    // Real other-host marketplace listings (never include pricing-proxy hosts)
    const fromMarketplaceRaw = await prisma.property.findMany({
      where: {
        published: true,
        listOnMarketplace: true,
        id: { not: listing.propertyId },
        hostId: { not: hostId },
        host: {
          active: true,
          approvalStatus: "APPROVED",
          listOnMarketplace: true,
          slug: { notIn: [...MARKETPLACE_EXCLUDED_HOST_SLUGS] },
        },
        maxGuests: {
          gte: Math.max(1, listing.maxGuests - 2),
          lte: listing.maxGuests + 2,
        },
      },
      select: {
        id: true,
        title: true,
        tagline: true,
        description: true,
        amenities: true,
        maxGuests: true,
        bedrooms: true,
        baseNightlyRate: true,
        city: true,
        region: true,
        latitude: true,
        longitude: true,
      },
      take: 80,
    });

    const candidates: Candidate[] = [
      ...fromPrivate,
      ...fromMarketplaceRaw.map((p) => ({
        ...p,
        privateProxy: false,
      })),
    ];

    const strictLocation =
      hitl.preferStrictLocation ||
      listing.quality.tier === "waterfront_prime";
    const fairMax = strictLocation
      ? FAIR_PEER_SCORE_MAX - 4
      : FAIR_PEER_SCORE_MAX;
    const softMax = hitl.preferStrictLocation
      ? SOFT_PEER_SCORE_MAX - 6
      : SOFT_PEER_SCORE_MAX;

    const ranked: PeerComp[] = [];
    for (const peer of candidates) {
      const quality = extractQualitySignals({
        amenitiesJson: peer.amenities,
        title: peer.title,
        description: peer.description,
        tagline: peer.tagline,
      });
      if (hitl.preferPoolMatch && listing.quality.hasPool && !quality.hasPool) {
        continue;
      }
      const distanceMiles = milesBetween(listing, peer);
      const guestDelta = Math.abs(peer.maxGuests - listing.maxGuests);
      const bedroomDelta = Math.abs(peer.bedrooms - listing.bedrooms);
      const { score, reasons } = peerMismatchScore(
        listing.quality,
        quality,
        {
          guestDelta,
          bedroomDelta,
          sameCity: Boolean(
            listing.city &&
              peer.city &&
              listing.city.toLowerCase() === peer.city.toLowerCase(),
          ),
          sameRegion: Boolean(
            listing.region &&
              peer.region &&
              listing.region.toLowerCase() === peer.region.toLowerCase(),
          ),
          distanceMiles,
        },
      );
      ranked.push({
        propertyId: peer.id,
        title: peer.title,
        maxGuests: peer.maxGuests,
        bedrooms: peer.bedrooms,
        baseNightlyRate: peer.baseNightlyRate,
        city: peer.city,
        region: peer.region,
        distanceGuests: guestDelta,
        matchScore: score,
        matchReasons: reasons,
        quality,
        distanceMiles,
        fair: score <= fairMax,
        privateProxy: peer.privateProxy,
      });
    }
    ranked.sort((a, b) => a.matchScore - b.matchScore);

    const fair = ranked.filter((p) => p.fair);
    const soft = ranked.filter((p) => p.matchScore <= softMax);
    // Prefer fair comps; fall back to soft if thin set
    const chosen =
      fair.length >= 3 ? fair.slice(0, 8) : soft.slice(0, 8);

    peerCompsByPropertyId[listing.propertyId] = chosen;
  }

  const external = await collectExternalSignals(listings, hitl);

  const notes: string[] = [
    `Matching: capacity + location tier (waterfront vs access vs view vs inland) + pool/dock + distance when coords exist.`,
    `Peers: private PricingMarketComp table (${privateComps.length} active) + real marketplace listings (never guest-visible proxies).`,
    `Fair peer score ≤ ${FAIR_PEER_SCORE_MAX}; soft ≤ ${SOFT_PEER_SCORE_MAX}. HITL strict-location=${hitl.preferStrictLocation}, pool-match=${hitl.preferPoolMatch}.`,
    `Period: ${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)} (${windowDays} days).`,
    `Listings: ${listings.length}. Bookings in window: ${bookings.length}. Prior HITL decisions: ${hitl.totalDecisions}.`,
  ];
  if (hitl.recentNotes.length > 0) {
    notes.push(
      `Recent host feedback: ${hitl.recentNotes.slice(0, 3).join(" · ")}`,
    );
  }
  if (external.source === "none") {
    notes.push(
      "No XAI_API_KEY — external OTA brief skipped; internal quality-balanced peers only.",
    );
  }

  return {
    collectedAt: new Date().toISOString(),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    hostId: host.id,
    hostName: host.name,
    listings,
    peerCompsByPropertyId,
    external,
    hitl,
    notes,
  };
}

async function loadHitlMemory(hostId: string): Promise<HitlMemory> {
  const rows = await prisma.pricingRecommendation.findMany({
    where: {
      run: { hostId },
      status: { in: ["APPROVED", "REJECTED", "APPLIED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
    select: {
      status: true,
      feedbackNotes: true,
      feedbackTags: true,
      rationale: true,
    },
  });

  const tagCounts: Record<string, number> = {};
  const recentNotes: string[] = [];
  let rejectedCount = 0;
  let approvedCount = 0;
  let appliedCount = 0;

  for (const r of rows) {
    if (r.status === "REJECTED") rejectedCount += 1;
    if (r.status === "APPROVED") approvedCount += 1;
    if (r.status === "APPLIED") appliedCount += 1;
    try {
      const tags = JSON.parse(r.feedbackTags || "[]") as string[];
      for (const t of tags) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    } catch {
      /* ignore */
    }
    if (r.feedbackNotes?.trim()) {
      recentNotes.push(r.feedbackNotes.trim().slice(0, 200));
    }
  }

  const locTags =
    (tagCounts.location_mismatch || 0) +
    (tagCounts.wrong_comps || 0) +
    (tagCounts.capacity_ok_location_wrong || 0);
  const amenityTags = tagCounts.amenity_mismatch || 0;

  return {
    totalDecisions: rows.length,
    rejectedCount,
    approvedCount,
    appliedCount,
    tagCounts,
    recentNotes: recentNotes.slice(0, 8),
    preferStrictLocation: locTags >= 2 || locTags / Math.max(1, rows.length) >= 0.25,
    preferPoolMatch: amenityTags >= 2,
  };
}

async function collectExternalSignals(
  listings: InternalListingStats[],
  hitl: HitlMemory,
): Promise<ExternalSignalNote> {
  const key =
    process.env.XAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key || listings.length === 0) {
    return {
      source: "none",
      summary:
        "No external LLM key. Comps use quality-balanced internal peers (tier + pool + distance).",
    };
  }

  const sample = listings.slice(0, 6).map((l) => ({
    title: l.title,
    maxGuests: l.maxGuests,
    bedrooms: l.bedrooms,
    city: l.city,
    region: l.region,
    currentRate: l.baseNightlyRate,
    locationTier: l.quality.tier,
    hasPool: l.quality.hasPool,
    hasPrivateDock: l.quality.hasPrivateDock,
    textHints: l.quality.textHints,
  }));

  const isXai = Boolean(process.env.XAI_API_KEY?.trim());
  const baseUrl = isXai
    ? "https://api.x.ai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model =
    process.env.PRICING_INTELLIGENCE_MODEL?.trim() ||
    (isXai ? "grok-4-1-fast-non-reasoning" : "gpt-4o-mini");

  const hitlNote =
    hitl.totalDecisions > 0
      ? `Prior host feedback tags: ${JSON.stringify(hitl.tagCounts)}. Notes: ${hitl.recentNotes.join(" | ") || "none"}.`
      : "No prior host feedback yet.";

  const prompt = `You are a vacation-rental market researcher (Airbnb/VRBO/Booking-style).

CRITICAL: Do not treat "sleeps N" as enough. Beachfront ≠ 1–2 miles inland. Lake + pool ≠ lake only. One row back from the beach is not the same as on the sand.

Given listings (JSON), write ≤350 words:
1) Fair nightly ranges for each location tier (waterfront_prime / water_access / water_view / inland) at that capacity.
2) Pool / dock premiums typical in the area when known.
3) What would make a bad comp (call out explicitly).
4) When data is unclear, say "needs human judgment" — do not invent prices.
5) No fake listing URLs.

${hitlNote}

Listings:
${JSON.stringify(sample, null, 2)}`;

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "Be cautious. Balance capacity with location quality and amenities. Prefer 'hold' when comps are mixed tiers.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return {
        source: "heuristic",
        summary: `LLM research failed (${res.status}): ${t.slice(0, 200)}`,
      };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    return {
      source: "llm",
      summary: text || "LLM returned empty content.",
    };
  } catch (e) {
    return {
      source: "heuristic",
      summary: `LLM research error: ${e instanceof Error ? e.message : "unknown"}`,
    };
  }
}
