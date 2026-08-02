import type { AnalystSuggestion, CollectorBundle, PeerComp } from "./types";

const MAX_ABS_CHANGE_PCT = 15; // hard guardrail on suggested swing
const MIN_CHANGE_PCT = 3; // ignore noise under 3%

/**
 * Analyst / pricing model agent.
 * Capacity (maxGuests) is the primary signal unless occupancy/seasonality is stronger.
 * Suggestion-only — never mutates rates.
 */
export function analyzePricing(
  bundle: CollectorBundle,
): AnalystSuggestion[] {
  const month = new Date(bundle.periodEnd).getUTCMonth(); // 0-11
  const seasonFactor = seasonalityFactor(month);

  return bundle.listings.map((listing) => {
    const peers = bundle.peerCompsByPropertyId[listing.propertyId] || [];
    const peerRates = peers.map((p) => p.baseNightlyRate).filter((r) => r > 0);
    const peerMedian = peerRates.length ? median(peerRates) : null;
    const peerMean = peerRates.length
      ? peerRates.reduce((a, b) => a + b, 0) / peerRates.length
      : null;

    const current = listing.baseNightlyRate;
    let target = current;
    let basis: AnalystSuggestion["basis"] = "CAPACITY";
    const reasons: string[] = [];
    let confidence = 0.45;

    // --- Capacity-matched peer anchor (primary) ---
    if (peerMedian != null && peerMedian > 0) {
      target = peerMedian;
      basis = "CAPACITY";
      confidence = Math.min(0.85, 0.5 + peers.length * 0.04);
      reasons.push(
        `Capacity-matched peers (sleeps ~${listing.maxGuests}): median nightly $${peerMedian.toFixed(0)} across ${peers.length} marketplace comps (±1 guest).`,
      );
      if (peerMean != null && Math.abs(peerMean - peerMedian) / peerMedian > 0.12) {
        reasons.push(
          `Peer mean $${peerMean.toFixed(0)} differs from median — distribution is skewed; median preferred.`,
        );
      }
    } else {
      reasons.push(
        `Few capacity-matched marketplace peers for sleeps ${listing.maxGuests}. Holding near current rate with light seasonality only.`,
      );
      confidence = 0.35;
      basis = "MIXED";
    }

    // --- Occupancy / demand overlay (can strengthen or override) ---
    const occ = listing.occupancyEstimate90d;
    if (occ >= 0.65 && current > 0) {
      const lift = 1.06;
      const occTarget = current * lift;
      if (peerMedian == null || occTarget > target) {
        target = Math.max(target, occTarget);
        basis = peerMedian != null ? "MIXED" : "OCCUPANCY";
        reasons.push(
          `High occupancy estimate (~${(occ * 100).toFixed(0)}% of nights booked in window) supports a modest premium.`,
        );
        confidence = Math.min(0.9, confidence + 0.08);
      }
    } else if (occ < 0.2 && listing.bookingCount90d < 2 && current > 0) {
      const cut = 0.94;
      const soft = current * cut;
      if (peerMedian == null || soft < target) {
        target = Math.min(target, soft);
        basis = peerMedian != null ? "MIXED" : "OCCUPANCY";
        reasons.push(
          `Soft demand (${listing.bookingCount90d} bookings / ~${(occ * 100).toFixed(0)}% occupancy estimate) suggests testing a small discount or promo.`,
        );
      }
    }

    // --- Seasonality ---
    if (Math.abs(seasonFactor - 1) >= 0.03) {
      target = target * seasonFactor;
      if (basis === "CAPACITY") basis = "MIXED";
      else if (basis !== "MIXED") basis = "SEASONALITY";
      reasons.push(
        `Seasonality factor ${seasonFactor.toFixed(2)} for this month (peak summer/holiday vs shoulder).`,
      );
    }

    // External brief may note competitive pressure — keep as soft note only
    if (bundle.external.source === "llm" && bundle.external.summary) {
      reasons.push(
        "External market brief (LLM) attached to the run report — use as context, not a hard override of capacity peers.",
      );
      confidence = Math.min(0.92, confidence + 0.03);
    }

    // Guardrails
    let changePct =
      current > 0 ? ((target - current) / current) * 100 : 0;
    if (Math.abs(changePct) > MAX_ABS_CHANGE_PCT) {
      const capped =
        current * (1 + (Math.sign(changePct) * MAX_ABS_CHANGE_PCT) / 100);
      reasons.push(
        `Capped change at ±${MAX_ABS_CHANGE_PCT}% guardrail (raw target was $${target.toFixed(0)}).`,
      );
      target = capped;
      changePct = ((target - current) / current) * 100;
      confidence = Math.max(0.3, confidence - 0.1);
    }

    // Round to friendly $5
    target = Math.max(25, Math.round(target / 5) * 5);
    changePct = current > 0 ? ((target - current) / current) * 100 : 0;

    const doNothing = Math.abs(changePct) < MIN_CHANGE_PCT;
    if (doNothing) {
      target = current;
      changePct = 0;
      reasons.push(
        `Suggested move under ${MIN_CHANGE_PCT}% — recommend do nothing this cycle.`,
      );
    }

    const experimentNote = doNothing
      ? "No experiment needed. Revisit next month with fresher booking data."
      : changePct > 0
        ? `A/B or time-split: hold current rate 50% of upcoming weekends; test +${Math.abs(changePct).toFixed(0)}% on the other half for 14 days. Watch conversion and booked nights.`
        : `Test −${Math.abs(changePct).toFixed(0)}% on midweek inventory for 14 days (or a “midweek special” discount) before changing the base rate permanently.`;

    const projectedImpact = doNothing
      ? "Neutral — insufficient edge to justify a price move."
      : changePct > 0
        ? `If conversion holds, rough revenue lift on base nights ≈ +${changePct.toFixed(1)}% before elasticity. With elasticity −0.6, expected demand dip ~${(0.6 * changePct).toFixed(1)}% of bookings.`
        : `Lower rate may improve occupancy; contribution depends on cleaning/tax fixed costs. Track booked nights and ADR together.`;

    const riskNotes = [
      !listing.published ? "Listing is unpublished — guests will not see the new rate until live." : null,
      peers.length < 3
        ? "Thin peer set — confidence is limited; treat as directional."
        : null,
      "Human approval required before any catalog change.",
    ]
      .filter(Boolean)
      .join(" ");

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
        occupancyEstimate90d: listing.occupancyEstimate90d,
        bookingCount90d: listing.bookingCount90d,
        peerMedian,
        peerMean,
        peerCount: peers.length,
        peers: peers.slice(0, 5).map(summarizePeer),
        seasonFactor,
      },
      doNothing,
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
  };
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Rough US South STR seasonality by calendar month (1.0 = baseline). */
function seasonalityFactor(monthIndex: number): number {
  // 0=Jan … 11=Dec
  const table = [
    0.92, // Jan
    0.94, // Feb
    1.0, // Mar spring break
    1.02, // Apr
    1.06, // May
    1.1, // Jun
    1.12, // Jul
    1.1, // Aug
    0.98, // Sep
    1.0, // Oct
    0.96, // Nov
    1.04, // Dec holidays
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
    `- **Primary anchor:** comparable listings by **house capacity** (\`maxGuests\` ±1).`,
    `- **Secondary:** occupancy / booking velocity, light seasonality.`,
    `- **External:** ${bundle.external.source} — ${bundle.external.summary.slice(0, 280)}${bundle.external.summary.length > 280 ? "…" : ""}`,
    `- **Guardrails:** max ±${15}% per cycle; ignore moves under 3%; human approval before apply.`,
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
      `- Current: **$${s.currentNightlyRate.toFixed(0)}** → Suggested: **$${s.suggestedNightlyRate.toFixed(0)}** (${s.changePercent >= 0 ? "+" : ""}${s.changePercent}%)`,
      `- Basis: ${s.basis} · Confidence: ${(s.confidence * 100).toFixed(0)}%`,
      `- ${s.rationale}`,
      `- Experiment: ${s.experimentNote}`,
      `- Impact: ${s.projectedImpact}`,
      `- Risks: ${s.riskNotes}`,
      ``,
    );
  }

  if (bundle.external.source === "llm") {
    lines.push(`## External market brief`, ``, bundle.external.summary, ``);
  }

  lines.push(
    `## Next steps`,
    `1. Review each suggestion in Admin → Pricing intelligence.`,
    `2. Approve only what you want applied to base nightly rate.`,
    `3. Prefer running the suggested experiment before large permanent moves.`,
    ``,
  );

  return lines.join("\n");
}
