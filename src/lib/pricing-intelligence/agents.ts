/**
 * Multi-step pricing agents (LLM-backed when keys present).
 */
import type { AnalystSuggestion, CollectorBundle } from "./types";
import { pricingLlmChat, pricingLlmConfigured } from "./llm";

export async function runMarketBriefAgent(
  bundle: CollectorBundle,
): Promise<{ summary: string; source: "llm" | "heuristic"; model?: string }> {
  const peerSnapshot = bundle.listings.map((l) => {
    const peers = bundle.peerCompsByPropertyId[l.propertyId] || [];
    const fair = peers.filter((p) => p.fair);
    const rates = fair.map((p) => p.baseNightlyRate).filter((r) => r > 0);
    const sorted = [...rates].sort((a, b) => a - b);
    return {
      title: l.title,
      sleeps: l.maxGuests,
      bedrooms: l.bedrooms,
      city: l.city,
      current: l.baseNightlyRate,
      tier: l.quality.tier,
      dock: l.quality.hasPrivateDock,
      pool: l.quality.hasPool,
      fairPeerCount: fair.length,
      softPeerCount: peers.length - fair.length,
      fairRateMin: sorted[0] ?? null,
      fairRateMax: sorted[sorted.length - 1] ?? null,
      fairMedian:
        sorted.length > 0
          ? sorted[Math.floor(sorted.length / 2)]
          : null,
      samplePeers: peers.slice(0, 8).map((p) => ({
        title: p.title,
        rate: p.baseNightlyRate,
        sleeps: p.maxGuests,
        tier: p.quality.tier,
        fair: p.fair,
        city: p.city,
      })),
    };
  });

  if (!pricingLlmConfigured()) {
    const lines = peerSnapshot.map((s) => {
      const band =
        s.fairMedian != null
          ? `fair comps $${s.fairRateMin}–$${s.fairRateMax} (median $${s.fairMedian}, n=${s.fairPeerCount})`
          : "no fair comps — hold or human judgment";
      return `• ${s.title} (sleeps ${s.sleeps}, ${s.tier}, current $${s.current}): ${band}`;
    });
    return {
      source: "heuristic",
      summary: [
        "Heuristic market brief (no XAI_API_KEY on this service).",
        "Location tier + capacity + dock/pool still drive peer selection.",
        "",
        ...lines,
        "",
        "Waterfront_prime with private dock should not be priced off inland or second-row access comps.",
        "Prefer hold when fair peer set is thin; soft comps are contrast only.",
      ].join("\n"),
    };
  }

  const llm = await pricingLlmChat({
    temperature: 0.25,
    maxTokens: 1400,
    system: `You are a senior vacation-rental market researcher for US lake/beach markets (Airbnb/VRBO style ADR research).
Be thorough and cautious. Never invent specific competitor listing URLs.
Critical rules:
- sleeps N alone is NOT enough
- waterfront_prime / private dock ≠ water_access / second row ≠ inland + pool
- Say when human judgment is required
- Give fair nightly ranges by tier when evidence supports it`,
    user: `Write a detailed market brief (500–800 words) for this host's research run.

Host: ${bundle.hostName}
Period: ${bundle.periodStart.slice(0, 10)} → ${bundle.periodEnd.slice(0, 10)}
HITL prior decisions: ${bundle.hitl.totalDecisions}; tags=${JSON.stringify(bundle.hitl.tagCounts)}

Listing + peer snapshot:
${JSON.stringify(peerSnapshot, null, 2)}

Cover:
1) Per-listing fair ADR range and why
2) Which comps are fair vs soft (and why soft should not drag waterfront)
3) Seasonal / demand caveats from occupancy if present
4) Explicit risks of over/under-pricing
5) What to ask the host if comps are mixed`,
  });

  if (!llm.ok) {
    return {
      source: "heuristic",
      summary: `LLM market brief failed (${llm.error}). Falling back to peer medians only.\n\n${peerSnapshot.map((s) => `${s.title}: median ${s.fairMedian ?? "n/a"}`).join("\n")}`,
    };
  }

  return { source: "llm", summary: llm.text, model: llm.model };
}

export async function runAnalystCritiqueAgent(
  bundle: CollectorBundle,
  suggestions: AnalystSuggestion[],
): Promise<AnalystSuggestion[]> {
  if (!pricingLlmConfigured() || suggestions.length === 0) {
    return suggestions;
  }

  const payload = suggestions.map((s) => {
    const listing = bundle.listings.find((l) => l.propertyId === s.propertyId);
    const peers = bundle.peerCompsByPropertyId[s.propertyId] || [];
    return {
      propertyId: s.propertyId,
      title: listing?.title,
      current: s.currentNightlyRate,
      suggested: s.suggestedNightlyRate,
      changePercent: s.changePercent,
      confidence: s.confidence,
      rationale: s.rationale,
      doNothing: s.doNothing,
      needsHitl: s.needsHitlClarification,
      tier: listing?.quality.tier,
      sleeps: listing?.maxGuests,
      fairPeers: peers
        .filter((p) => p.fair)
        .slice(0, 10)
        .map((p) => ({
          title: p.title,
          rate: p.baseNightlyRate,
          sleeps: p.maxGuests,
          tier: p.quality.tier,
        })),
    };
  });

  const llm = await pricingLlmChat({
    temperature: 0.2,
    maxTokens: 2000,
    system: `You critique pricing suggestions for vacation rentals.
Return ONLY valid JSON array (no markdown fences). Each item:
{
  "propertyId": string,
  "suggestedNightlyRate": number,
  "confidence": number 0-1,
  "rationale": string,
  "doNothing": boolean,
  "needsHitlClarification": boolean,
  "hitlPrompt": string | null,
  "experimentNote": string,
  "riskNotes": string
}
Rules: stay within ±15% of current unless evidence is overwhelming; never price waterfront off inland; prefer doNothing when fair peers < 2.`,
    user: `Critique and refine these draft suggestions. Market brief:

${bundle.external.summary.slice(0, 2500)}

Drafts:
${JSON.stringify(payload, null, 2)}`,
  });

  if (!llm.ok) return suggestions;

  try {
    const cleaned = llm.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const arr = JSON.parse(cleaned) as Array<{
      propertyId: string;
      suggestedNightlyRate?: number;
      confidence?: number;
      rationale?: string;
      doNothing?: boolean;
      needsHitlClarification?: boolean;
      hitlPrompt?: string | null;
      experimentNote?: string;
      riskNotes?: string;
    }>;
    if (!Array.isArray(arr)) return suggestions;

    return suggestions.map((s) => {
      const hit = arr.find((a) => a.propertyId === s.propertyId);
      if (!hit) return s;
      const current = s.currentNightlyRate;
      let suggested =
        typeof hit.suggestedNightlyRate === "number"
          ? hit.suggestedNightlyRate
          : s.suggestedNightlyRate;
      // Guardrail again
      if (current > 0) {
        const maxUp = current * 1.15;
        const maxDown = current * 0.85;
        suggested = Math.min(maxUp, Math.max(maxDown, suggested));
      }
      suggested = Math.max(25, Math.round(suggested / 5) * 5);
      const changePercent =
        current > 0
          ? Math.round(((suggested - current) / current) * 1000) / 10
          : 0;
      return {
        ...s,
        suggestedNightlyRate: suggested,
        changePercent,
        confidence:
          typeof hit.confidence === "number"
            ? Math.min(0.95, Math.max(0.2, hit.confidence))
            : s.confidence,
        rationale: hit.rationale?.trim() || s.rationale,
        doNothing:
          typeof hit.doNothing === "boolean"
            ? hit.doNothing
            : Math.abs(changePercent) < 3,
        needsHitlClarification:
          hit.needsHitlClarification ?? s.needsHitlClarification,
        hitlPrompt: hit.hitlPrompt ?? s.hitlPrompt,
        experimentNote: hit.experimentNote?.trim() || s.experimentNote,
        riskNotes: hit.riskNotes?.trim() || s.riskNotes,
      };
    });
  } catch {
    return suggestions;
  }
}

export async function runRecommenderAgent(
  bundle: CollectorBundle,
  suggestions: AnalystSuggestion[],
): Promise<{ reportExtra: string; suggestions: AnalystSuggestion[] }> {
  if (!pricingLlmConfigured()) {
    return {
      reportExtra:
        "_Recommender LLM skipped (no API key). Deterministic analysis only._",
      suggestions,
    };
  }

  const compact = suggestions.map((s) => {
    const listing = bundle.listings.find((l) => l.propertyId === s.propertyId);
    return {
      propertyId: s.propertyId,
      title: listing?.title,
      current: s.currentNightlyRate,
      suggested: s.suggestedNightlyRate,
      pct: s.changePercent,
      rationale: s.rationale.slice(0, 400),
      experimentNote: s.experimentNote,
    };
  });

  const llm = await pricingLlmChat({
    temperature: 0.35,
    maxTokens: 1800,
    system: `You are the recommender agent for a host-facing pricing product.
Write clear, non-hype recommendations. Hosts approve before any change.
Return JSON: {
  "executiveSummary": string (200-350 words markdown),
  "items": [{ "propertyId": string, "experimentNote": string, "projectedImpact": string, "riskNotes": string }]
}`,
    user: `Host ${bundle.hostName}. Produce executive summary + polished experiment notes.

Market brief excerpt:
${bundle.external.summary.slice(0, 2000)}

Suggestions:
${JSON.stringify(compact, null, 2)}`,
  });

  if (!llm.ok) {
    return {
      reportExtra: `Recommender LLM failed: ${llm.error}`,
      suggestions,
    };
  }

  try {
    const cleaned = llm.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      executiveSummary?: string;
      items?: Array<{
        propertyId: string;
        experimentNote?: string;
        projectedImpact?: string;
        riskNotes?: string;
      }>;
    };
    const items = parsed.items || [];
    const next = suggestions.map((s) => {
      const hit = items.find((i) => i.propertyId === s.propertyId);
      if (!hit) return s;
      return {
        ...s,
        experimentNote: hit.experimentNote?.trim() || s.experimentNote,
        projectedImpact: hit.projectedImpact?.trim() || s.projectedImpact,
        riskNotes: hit.riskNotes?.trim() || s.riskNotes,
      };
    });
    return {
      reportExtra: parsed.executiveSummary || llm.text,
      suggestions: next,
    };
  } catch {
    return { reportExtra: llm.text, suggestions };
  }
}
