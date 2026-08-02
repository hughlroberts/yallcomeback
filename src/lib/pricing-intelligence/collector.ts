import { prisma } from "@/lib/db";
import type {
  CollectorBundle,
  ExternalSignalNote,
  InternalListingStats,
  PeerComp,
} from "./types";

/**
 * Data Collector agent (platform-only).
 * Pulls internal booking/listing stats and capacity-matched peer comps
 * from the shared marketplace inventory.
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
      status: {
        in: ["CONFIRMED", "COMPLETED", "PENDING_PAYMENT"],
      },
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
        Math.round(
          (b.checkIn.getTime() - b.createdAt.getTime()) / 86400000,
        ),
      )
      .filter((d) => d >= 0 && d < 400);
    const avgLead =
      leadTimes.length > 0
        ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
        : null;

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
    };
  });

  // Peer comps: marketplace peers matched primarily by maxGuests (±1), then region/city
  const peerCompsByPropertyId: Record<string, PeerComp[]> = {};
  for (const listing of listings) {
    const peers = await prisma.property.findMany({
      where: {
        published: true,
        listOnMarketplace: true,
        id: { not: listing.propertyId },
        hostId: { not: hostId },
        host: {
          active: true,
          approvalStatus: "APPROVED",
          listOnMarketplace: true,
        },
        maxGuests: {
          gte: Math.max(1, listing.maxGuests - 1),
          lte: listing.maxGuests + 1,
        },
      },
      select: {
        id: true,
        title: true,
        maxGuests: true,
        bedrooms: true,
        baseNightlyRate: true,
        city: true,
        region: true,
      },
      take: 40,
    });

    const ranked: PeerComp[] = peers
      .map((peer) => {
        const distanceGuests = Math.abs(peer.maxGuests - listing.maxGuests);
        let score = distanceGuests * 10;
        if (
          listing.region &&
          peer.region &&
          peer.region.toLowerCase() === listing.region.toLowerCase()
        ) {
          score -= 3;
        }
        if (
          listing.city &&
          peer.city &&
          peer.city.toLowerCase() === listing.city.toLowerCase()
        ) {
          score -= 5;
        }
        return {
          propertyId: peer.id,
          title: peer.title,
          maxGuests: peer.maxGuests,
          bedrooms: peer.bedrooms,
          baseNightlyRate: peer.baseNightlyRate,
          city: peer.city,
          region: peer.region,
          distanceGuests,
          _score: score,
        };
      })
      .sort((a, b) => a._score - b._score)
      .slice(0, 8)
      .map(({ _score: _s, ...rest }) => rest);

    peerCompsByPropertyId[listing.propertyId] = ranked;
  }

  const external = await collectExternalSignals(listings);

  const notes: string[] = [
    `Primary matching key: maxGuests (house capacity) ±1 guest.`,
    `Period: ${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)} (${windowDays} days).`,
    `Listings analyzed: ${listings.length}. Bookings in window: ${bookings.length}.`,
  ];
  if (external.source === "none") {
    notes.push(
      "External OTA browse not configured (set XAI_API_KEY for richer market notes). Using internal marketplace peers only.",
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
    notes,
  };
}

/**
 * Lightweight external signal: optional LLM summary of local STR market.
 * Does not scrape OTAs directly (ToS / cost); asks model for public market norms.
 */
async function collectExternalSignals(
  listings: InternalListingStats[],
): Promise<ExternalSignalNote> {
  const key =
    process.env.XAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key || listings.length === 0) {
    return {
      source: "none",
      summary:
        "No external LLM key configured. Recommendations rely on internal capacity-matched peers and occupancy heuristics.",
    };
  }

  const sample = listings.slice(0, 6).map((l) => ({
    title: l.title,
    maxGuests: l.maxGuests,
    bedrooms: l.bedrooms,
    city: l.city,
    region: l.region,
    currentRate: l.baseNightlyRate,
  }));

  const isXai = Boolean(process.env.XAI_API_KEY?.trim());
  const baseUrl = isXai
    ? "https://api.x.ai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model =
    process.env.PRICING_INTELLIGENCE_MODEL?.trim() ||
    (isXai ? "grok-4-1-fast-non-reasoning" : "gpt-4o-mini");

  const prompt = `You are a vacation-rental market researcher for Southern US short-term rentals (Airbnb/VRBO/Booking-style comps).

Given these host listings (JSON), write a short market research brief (max 350 words):
1) Typical nightly ranges by guest capacity (sleeps N) in the same city/region when known.
2) Seasonality notes (weekends, lake/holiday peaks) relevant to Texas / South if location fits.
3) Factors that should OVERRIDE capacity matching only if strong (waterfront, luxury finishes, new listing discount, etc.).
4) Do NOT invent exact competitor listing URLs. Prefer ranges and qualitative guidance.

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
        temperature: 0.3,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "Be concise, practical, and cautious. Prefer capacity (sleeps N) as the primary pricing anchor.",
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
