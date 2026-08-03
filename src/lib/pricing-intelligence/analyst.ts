import { FAIR_PEER_SCORE_MAX } from "./location-quality";
import type { AnalystSuggestion, CollectorBundle, PeerComp } from "./types";

const MAX_ABS_CHANGE_PCT = 15;
const MIN_CHANGE_PCT = 3;

/**
 * Analyst / pricing model.
 * Uses quality-balanced peers (capacity + location tier + pool/dock + distance).
 * When comps are mixed or thin, lowers confidence and asks for HITL clarification.
 */
export function analyzePricing(
  bundle: CollectorBundle,
): AnalystSuggestion[] {
  const month = new Date(bundle.periodEnd).getUTCMonth();
  const seasonFactor = seasonalityFactor(month);
  const hitl = bundle.hitl;

  return bundle.listings.map((listing) => {
    const allPeers = bundle.peerCompsByPropertyId[listing.propertyId] || [];
    const fairPeers = allPeers.filter((p) => p.fair);
    const peers = fairPeers.length >= 2 ? fairPeers : allPeers;
    const usedSoftSet = fairPeers.length < 2 && allPeers.length > 0;

    const peerRates = peers.map((p) => p.baseNightlyRate).filter((r) => r > 0);
    // Weight fairer peers more (inverse match score)
    const peerMedian = peerRates.length
      ? weightedMedian(
          peers.map((p) => ({
            rate: p.baseNightlyRate,
            weight: Math.max(0.25, 1 / (1 + p.matchScore / 10)),
          })),
        )
      : null;
    const peerMean = peerRates.length
      ? peerRates.reduce((a, b) => a + b, 0) / peerRates.length
      : null;

    const current = listing.baseNightlyRate;
    let target = current;
    let basis: AnalystSuggestion["basis"] = "CAPACITY";
    const reasons: string[] = [];
    let confidence = 0.4;
    let needsHitlClarification = false;
    let hitlPrompt: string | undefined;

    const q = listing.quality;
    reasons.push(
      `Subject profile: sleeps ${listing.maxGuests}, location tier **${q.tier}**` +
        (q.hasPool ? ", pool" : "") +
        (q.hasPrivateDock ? ", private dock" : "") +
        (q.textHints.length ? ` (${q.textHints.slice(0, 3).join("; ")})` : "") +
        ".",
    );

    if (peerMedian != null && peerMedian > 0 && peers.length > 0) {
      target = peerMedian;
      basis = "MIXED";
      const fairShare = fairPeers.length / Math.max(1, peers.length);
      confidence = Math.min(
        0.88,
        0.42 + fairPeers.length * 0.05 + fairShare * 0.1,
      );
      reasons.push(
        `Quality-balanced peers: ${fairPeers.length} fair / ${peers.length} used (capacity ± location tier ± pool/dock` +
          (peers.some((p) => p.distanceMiles != null) ? " ± distance" : "") +
          `). Weighted median $${peerMedian.toFixed(0)}.` +
          (usedSoftSet
            ? " Fair-comp set was thin — included softer matches; treat carefully."
            : ""),
      );
      if (peerMean != null && Math.abs(peerMean - peerMedian) / peerMedian > 0.15) {
        reasons.push(
          `Peer mean $${peerMean.toFixed(0)} vs median $${peerMedian.toFixed(0)} — spread is wide; mixed location quality likely.`,
        );
        confidence = Math.max(0.28, confidence - 0.12);
        needsHitlClarification = true;
      }
    } else {
      reasons.push(
        `No usable quality-balanced peers for sleeps ${listing.maxGuests} + tier ${q.tier}. Prefer hold; human judgment needed.`,
      );
      confidence = 0.28;
      basis = "MIXED";
      needsHitlClarification = true;
      hitlPrompt =
        "No strong comps with similar capacity and location quality (e.g. waterfront vs inland, pool vs no pool). Hold rate or tell us which nearby stays are true comps.";
    }

    // Flag when best peers still have location mismatch reasons
    const locationMismatchHeavy = peers.filter((p) =>
      p.matchReasons.some((r) => r.includes("location tier")),
    ).length;
    if (peers.length > 0 && locationMismatchHeavy >= Math.ceil(peers.length * 0.5)) {
      confidence = Math.max(0.25, confidence - 0.15);
      needsHitlClarification = true;
      hitlPrompt =
        hitlPrompt ||
        "Many comps differ in location quality (e.g. on the water vs a row back / miles inland). Confirm which peers are fair before changing price.";
      reasons.push(
        "Half+ of peer set has location-tier mismatch — beach/lake frontage is not interchangeable with nearby inland.",
      );
    }

    // Occupancy overlay (weaker when location comps unclear)
    const occ = listing.occupancyEstimate90d;
    if (!needsHitlClarification || confidence >= 0.45) {
      if (occ >= 0.65 && current > 0) {
        const occTarget = current * 1.05;
        if (peerMedian == null || occTarget > target * 0.98) {
          target = Math.max(target, Math.min(target * 1.08, occTarget));
          reasons.push(
            `High occupancy (~${(occ * 100).toFixed(0)}%) supports a small premium if comps allow.`,
          );
          confidence = Math.min(0.9, confidence + 0.05);
        }
      } else if (occ < 0.2 && listing.bookingCount90d < 2 && current > 0) {
        const soft = current * 0.95;
        if (peerMedian == null || soft < target) {
          target = Math.min(target, soft);
          reasons.push(
            `Soft demand (${listing.bookingCount90d} bookings) — small promo may help; do not slash if you are true waterfront/premium.`,
          );
        }
      }
    }

    if (Math.abs(seasonFactor - 1) >= 0.03 && !needsHitlClarification) {
      target = target * seasonFactor;
      reasons.push(
        `Seasonality factor ${seasonFactor.toFixed(2)} for this month.`,
      );
    }

    // HITL memory: if hosts often said too aggressive, shrink moves
    if ((hitl.tagCounts.too_aggressive || 0) >= 2) {
      const mid = (current + target) / 2;
      target = mid;
      reasons.push(
        "Prior host feedback often marked suggestions as too aggressive — halved the step toward peer median.",
      );
      confidence = Math.max(0.3, confidence - 0.05);
    }
    if ((hitl.tagCounts.too_conservative || 0) >= 2 && peerMedian != null) {
      target = (target + peerMedian) / 2 + (peerMedian - current) * 0.15;
      reasons.push(
        "Prior feedback: suggestions too conservative — nudged further toward peer median.",
      );
    }

    if (bundle.external.source === "llm") {
      reasons.push(
        "External market brief attached — use for context; never overrides a clear waterfront vs inland mismatch.",
      );
    }

    // Guardrails
    let changePct = current > 0 ? ((target - current) / current) * 100 : 0;
    if (Math.abs(changePct) > MAX_ABS_CHANGE_PCT) {
      target =
        current * (1 + (Math.sign(changePct) * MAX_ABS_CHANGE_PCT) / 100);
      reasons.push(
        `Capped at ±${MAX_ABS_CHANGE_PCT}% guardrail (raw target was higher/lower).`,
      );
      changePct = ((target - current) / current) * 100;
      confidence = Math.max(0.28, confidence - 0.08);
    }

    target = Math.max(25, Math.round(target / 5) * 5);
    changePct = current > 0 ? ((target - current) / current) * 100 : 0;

    // Prefer hold when unclear
    let doNothing =
      Math.abs(changePct) < MIN_CHANGE_PCT || needsHitlClarification;
    if (needsHitlClarification && Math.abs(changePct) >= MIN_CHANGE_PCT) {
      // Still show directional suggestion but mark as needs HITL; soft-hold default
      doNothing = Math.abs(changePct) < 6; // only tiny moves auto-hold
      if (!doNothing) {
        reasons.push(
          "Direction kept for discussion, but confidence is limited — prefer human review before apply.",
        );
      } else {
        target = current;
        changePct = 0;
        reasons.push(
          "Unclear comps — recommending hold until you confirm fair peer set.",
        );
      }
    } else if (doNothing && !needsHitlClarification) {
      target = current;
      changePct = 0;
      reasons.push(
        `Move under ${MIN_CHANGE_PCT}% — do nothing this cycle.`,
      );
    }

    const experimentNote = doNothing
      ? needsHitlClarification
        ? "Tag feedback (location/amenity mismatch) if you reject or hold — that teaches the next monthly run."
        : "No experiment needed. Revisit next month."
      : changePct > 0
        ? `Test +${Math.abs(changePct).toFixed(0)}% on ~half of upcoming peak nights for 14 days before full base-rate change.`
        : `Test a midweek promo near −${Math.abs(changePct).toFixed(0)}% for 14 days before cutting base rate.`;

    const projectedImpact = doNothing
      ? "Neutral until comps are clearer or demand data improves."
      : changePct > 0
        ? `If conversion holds, base ADR +${changePct.toFixed(1)}%. Elasticity −0.6 ⇒ rough demand dip ~${(0.6 * changePct).toFixed(1)}%.`
        : `Lower base may lift occupancy; watch ADR × nights, not rate alone.`;

    const riskNotes = [
      !listing.published ? "Unpublished listing." : null,
      peers.length < 3 ? "Thin peer set." : null,
      usedSoftSet ? "Used soft (less fair) comps." : null,
      needsHitlClarification
        ? "Needs human confirmation of comps before trusting the number."
        : null,
      "Approve → Apply is required; nothing auto-changes.",
    ]
      .filter(Boolean)
      .join(" ");

    if (!hitlPrompt && needsHitlClarification) {
      hitlPrompt =
        "Which nearby stays are true comps for this property? (same waterfront/pool class matters more than sleeps alone.)";
    }

    return {
      propertyId: listing.propertyId,
      currentNightlyRate: current,
      suggestedNightlyRate: target,
      changePercent: Math.round(changePct * 10) / 10,
      basis,
      confidence: Math.round(confidence * 100) / 100,
      rationale: reasons.join(" "),
      experimentNote,
      projectedImpact,
      riskNotes: riskNotes || "None noted.",
      evidence: {
        maxGuests: listing.maxGuests,
        bedrooms: listing.bedrooms,
        locationTier: q.tier,
        hasPool: q.hasPool,
        hasPrivateDock: q.hasPrivateDock,
        occupancyEstimate90d: listing.occupancyEstimate90d,
        bookingCount90d: listing.bookingCount90d,
        peerMedian,
        peerMean,
        peerCount: peers.length,
        fairPeerCount: fairPeers.length,
        peers: peers.slice(0, 6).map(summarizePeer),
        seasonFactor,
        fairScoreMax: FAIR_PEER_SCORE_MAX,
        hitl: {
          preferStrictLocation: hitl.preferStrictLocation,
          preferPoolMatch: hitl.preferPoolMatch,
          tagCounts: hitl.tagCounts,
        },
        needsHitlClarification,
      },
      doNothing,
      needsHitlClarification,
      hitlPrompt,
    };
  });
}

function summarizePeer(p: PeerComp) {
  return {
    title: p.title,
    maxGuests: p.maxGuests,
    rate: p.baseNightlyRate,
    city: p.city,
    region: p.region,
    tier: p.quality.tier,
    hasPool: p.quality.hasPool,
    matchScore: p.matchScore,
    fair: p.fair,
    distanceMiles: p.distanceMiles,
    matchReasons: p.matchReasons.slice(0, 4),
  };
}

function weightedMedian(
  items: { rate: number; weight: number }[],
): number | null {
  const valid = items.filter((i) => i.rate > 0 && i.weight > 0);
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a.rate - b.rate);
  const totalW = sorted.reduce((s, i) => s + i.weight, 0);
  let acc = 0;
  for (const item of sorted) {
    acc += item.weight;
    if (acc >= totalW / 2) return item.rate;
  }
  return sorted[sorted.length - 1]!.rate;
}

function seasonalityFactor(monthIndex: number): number {
  const table = [
    0.92, 0.94, 1.0, 1.02, 1.06, 1.1, 1.12, 1.1, 0.98, 1.0, 0.96, 1.04,
  ];
  return table[monthIndex] ?? 1;
}

export function buildReportMarkdown(
  bundle: CollectorBundle,
  suggestions: AnalystSuggestion[],
): string {
  const lines: string[] = [
    `# Market pricing research — ${bundle.hostName}`,
    ``,
    `Period: ${bundle.periodStart.slice(0, 10)} → ${bundle.periodEnd.slice(0, 10)}`,
    `Collected: ${bundle.collectedAt}`,
    ``,
    `## Method`,
    `- **Balance:** capacity (sleeps N) **and** location tier (waterfront_prime / water_access / water_view / inland), pool, dock, distance when known.`,
    `- Beachfront ≠ 1–2 mi inland; lake+pool ≠ lake-only; one row back is not true frontage.`,
    `- **HITL memory:** ${bundle.hitl.totalDecisions} prior decisions; strict-location=${bundle.hitl.preferStrictLocation}; pool-match=${bundle.hitl.preferPoolMatch}.`,
    `- **External:** ${bundle.external.source}`,
    `- **Guardrails:** ±${MAX_ABS_CHANGE_PCT}% max; hold under ${MIN_CHANGE_PCT}% or when comps unclear.`,
    ``,
    `## Collector notes`,
    ...bundle.notes.map((n) => `- ${n}`),
    ``,
    `## Recommendations`,
  ];

  for (const s of suggestions) {
    const listing = bundle.listings.find((l) => l.propertyId === s.propertyId);
    lines.push(
      `### ${listing?.title || s.propertyId}`,
      `- Tier: **${listing?.quality.tier ?? "?"}** · Sleeps ${listing?.maxGuests ?? "?"} · Pool=${listing?.quality.hasPool ? "yes" : "no"}`,
      `- Current **$${s.currentNightlyRate.toFixed(0)}** → Suggested **$${s.suggestedNightlyRate.toFixed(0)}** (${s.changePercent >= 0 ? "+" : ""}${s.changePercent}%)`,
      `- Basis: ${s.basis} · Confidence: ${(s.confidence * 100).toFixed(0)}%` +
        (s.needsHitlClarification ? " · **needs HITL**" : ""),
      `- ${s.rationale}`,
      s.hitlPrompt ? `- HITL prompt: ${s.hitlPrompt}` : "",
      ``,
    );
  }

  if (bundle.external.source === "llm") {
    lines.push(`## External market brief`, ``, bundle.external.summary, ``);
  }

  lines.push(
    `## HITL`,
    `When you approve, reject, or apply — leave tags/notes (wrong comps, location mismatch, etc.). That feedback tightens next month’s peer set.`,
    ``,
  );

  return lines.filter((l) => l !== "").join("\n");
}
