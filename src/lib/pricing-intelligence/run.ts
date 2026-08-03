import { prisma } from "@/lib/db";
import type { PricingRunTrigger, PricingRecBasis } from "@prisma/client";
import {
  canRunPricingIntelligence,
  isPricingIntelligenceEnabled,
  PRICING_INTELLIGENCE_ADDON_USD,
} from "@/lib/platform-features";
import { collectHostPricingData } from "./collector";
import { analyzePricing, buildReportMarkdown } from "./analyst";
import {
  runAnalystCritiqueAgent,
  runMarketBriefAgent,
  runRecommenderAgent,
} from "./agents";
import { pricingLlmConfigured } from "./llm";
import {
  beginStep,
  completeStep,
  failStep,
  initialAgentSteps,
  skipStep,
} from "./steps";
import type { CollectorBundle } from "./types";

export type RunPricingOptions = {
  hostId: string;
  trigger?: PricingRunTrigger;
  lookbackDays?: number;
  bypassAddonCheck?: boolean;
  /**
   * When true, only create the RUNNING row and return — caller schedules
   * executePricingPipeline (e.g. via after()).
   */
  deferExecution?: boolean;
};

/**
 * Create a research run and optionally execute the full multi-agent pipeline.
 * Full pipeline: collect → market brief → analyze → LLM critique → recommend → finalize.
 */
export async function runPricingIntelligenceForHost(
  opts: RunPricingOptions,
): Promise<{ runId: string; recommendationCount: number; deferred?: boolean }> {
  if (!isPricingIntelligenceEnabled()) {
    throw new Error("Pricing intelligence is disabled on this deploy.");
  }

  const hostRow = await prisma.host.findUnique({
    where: { id: opts.hostId },
    select: {
      id: true,
      pricingIntelligenceEnabled: true,
      pricingIntelligenceAddonStatus: true,
    },
  });
  if (!hostRow) throw new Error("Host not found");
  if (!opts.bypassAddonCheck && !canRunPricingIntelligence(hostRow)) {
    throw new Error(
      `Pricing intelligence requires ops beta access and the $${PRICING_INTELLIGENCE_ADDON_USD}/mo add-on (ACTIVE). Not included in hosting.`,
    );
  }

  const lookback = opts.lookbackDays ?? 90;
  const periodEnd = new Date();
  const periodStart = new Date(
    periodEnd.getTime() - lookback * 24 * 60 * 60 * 1000,
  );
  const trigger = opts.trigger ?? "MANUAL";

  const run = await prisma.pricingIntelligenceRun.create({
    data: {
      hostId: opts.hostId,
      status: "RUNNING",
      trigger,
      periodStart,
      periodEnd,
      agentStepsJson: JSON.stringify(initialAgentSteps()),
      reportMarkdown:
        "_Research pipeline started. Agents are working through collect → market → analyze → critique → recommend…_",
    },
  });

  if (opts.deferExecution) {
    return { runId: run.id, recommendationCount: 0, deferred: true };
  }

  return executePricingPipeline(run.id, {
    hostId: opts.hostId,
    periodStart,
    periodEnd,
  });
}

/**
 * Multi-agent pipeline with step progress persisted for the UI.
 * Intended to run in the background (after()) for ~30–90s with LLM steps.
 */
export async function executePricingPipeline(
  runId: string,
  ctx: { hostId: string; periodStart: Date; periodEnd: Date },
): Promise<{ runId: string; recommendationCount: number }> {
  try {
    // —— 1. Collector (internal + peers) ——
    await beginStep(runId, "collect_internal");
    const bundle = await collectHostPricingData(
      ctx.hostId,
      ctx.periodStart,
      ctx.periodEnd,
      { skipExternal: true },
    );
    const peerTotal = Object.values(bundle.peerCompsByPropertyId).reduce(
      (n, a) => n + a.length,
      0,
    );
    await completeStep(
      runId,
      "collect_internal",
      `${bundle.listings.length} listing(s), ${peerTotal} peer comps, ${bundle.hitl.totalDecisions} prior HITL decisions.`,
      bundle.notes.join("\n"),
    );
    await prisma.pricingIntelligenceRun.update({
      where: { id: runId },
      data: { collectorJson: JSON.stringify(bundle) },
    });

    // —— 2. Market brief agent ——
    await beginStep(runId, "market_brief");
    const brief = await runMarketBriefAgent(bundle);
    const bundleWithBrief: CollectorBundle = {
      ...bundle,
      external: {
        source: brief.source,
        summary: brief.summary,
      },
      notes: [
        ...bundle.notes,
        brief.source === "llm"
          ? `Market brief via LLM${brief.model ? ` (${brief.model})` : ""}.`
          : "Market brief heuristic (LLM unavailable or failed).",
      ],
    };
    await completeStep(
      runId,
      "market_brief",
      brief.source === "llm"
        ? `LLM market brief ready (${brief.summary.length} chars).`
        : "Heuristic market brief (set XAI_API_KEY on the app service for full LLM research).",
      brief.summary.slice(0, 1500),
    );
    await prisma.pricingIntelligenceRun.update({
      where: { id: runId },
      data: { collectorJson: JSON.stringify(bundleWithBrief) },
    });

    // —— 3. Deterministic analyst ——
    await beginStep(runId, "analyze_rates");
    let suggestions = analyzePricing(bundleWithBrief);
    await completeStep(
      runId,
      "analyze_rates",
      `Drafted ${suggestions.length} suggestion(s); ${suggestions.filter((s) => !s.doNothing).length} directional, ${suggestions.filter((s) => s.doNothing).length} hold.`,
      suggestions
        .map(
          (s) =>
            `${s.propertyId}: $${s.currentNightlyRate} → $${s.suggestedNightlyRate} (${s.changePercent}%) conf=${s.confidence}`,
        )
        .join("\n"),
    );

    // —— 4. LLM critique / refine ——
    if (pricingLlmConfigured()) {
      await beginStep(runId, "llm_critique");
      suggestions = await runAnalystCritiqueAgent(bundleWithBrief, suggestions);
      await completeStep(
        runId,
        "llm_critique",
        `LLM critique applied to ${suggestions.length} listing(s).`,
        suggestions
          .map(
            (s) =>
              `${s.propertyId}: $${s.suggestedNightlyRate} (${s.changePercent}%) hitl=${Boolean(s.needsHitlClarification)}`,
          )
          .join("\n"),
      );
    } else {
      await skipStep(
        runId,
        "llm_critique",
        "Skipped — XAI_API_KEY not on this service. Deterministic analysis kept.",
      );
    }

    // —— 5. Recommender ——
    let reportExtra = "";
    if (pricingLlmConfigured()) {
      await beginStep(runId, "recommend");
      const rec = await runRecommenderAgent(bundleWithBrief, suggestions);
      suggestions = rec.suggestions;
      reportExtra = rec.reportExtra;
      await completeStep(
        runId,
        "recommend",
        "Executive summary and experiment notes written.",
        reportExtra.slice(0, 1200),
      );
    } else {
      await skipStep(
        runId,
        "recommend",
        "Skipped — no LLM key. Using template experiment notes from analyst.",
      );
    }

    // —— 6. Finalize ——
    await beginStep(runId, "finalize");
    let report = buildReportMarkdown(bundleWithBrief, suggestions);
    if (reportExtra) {
      report = `${report}\n\n## Executive summary (recommender)\n\n${reportExtra}\n`;
    }
    report += `\n\n## Pipeline\n- Multi-agent: collector → market brief → analyst → critique → recommender → human approve.\n- LLM configured: ${pricingLlmConfigured() ? "yes" : "no"}.\n`;

    await prisma.pricingRecommendation.deleteMany({ where: { runId } });
    await prisma.pricingRecommendation.createMany({
      data: suggestions.map((s) => ({
        runId,
        propertyId: s.propertyId,
        currentNightlyRate: s.currentNightlyRate,
        suggestedNightlyRate: s.suggestedNightlyRate,
        changePercent: s.changePercent,
        basis: s.basis as PricingRecBasis,
        confidence: s.confidence,
        rationale: s.rationale,
        experimentNote: s.experimentNote,
        projectedImpact: s.projectedImpact,
        riskNotes: s.riskNotes,
        evidenceJson: JSON.stringify({
          ...s.evidence,
          needsHitlClarification: s.needsHitlClarification,
          hitlPrompt: s.hitlPrompt,
          marketBriefSource: bundleWithBrief.external.source,
        }),
        status: s.doNothing ? "SKIPPED" : "PENDING",
      })),
    });

    const pending = suggestions.filter((s) => !s.doNothing).length;
    await prisma.pricingIntelligenceRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        collectorJson: JSON.stringify(bundleWithBrief),
        analystJson: JSON.stringify({
          suggestionCount: suggestions.length,
          pending,
          llmConfigured: pricingLlmConfigured(),
        }),
        reportMarkdown: report,
      },
    });
    await completeStep(
      runId,
      "finalize",
      `Complete — ${pending} suggestion(s) ready for human review. Nothing applied automatically.`,
    );

    return { runId, recommendationCount: pending };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await prisma.pricingIntelligenceRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: msg,
      },
    });
    // Best-effort mark current running step failed
    try {
      const run = await prisma.pricingIntelligenceRun.findUnique({
        where: { id: runId },
        select: { agentStepsJson: true },
      });
      const steps = JSON.parse(run?.agentStepsJson || "[]") as {
        id: string;
        status: string;
      }[];
      const running = steps.find((s) => s.status === "running");
      if (running) await failStep(runId, running.id, msg);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/**
 * Monthly cron: one run per eligible host that has not completed a run
 * in the last ~28 days.
 */
export async function runMonthlyPricingIntelligence(): Promise<{
  skipped: boolean;
  hostsProcessed: number;
  errors: string[];
}> {
  if (!isPricingIntelligenceEnabled()) {
    return { skipped: true, hostsProcessed: 0, errors: [] };
  }

  const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const hosts = await prisma.host.findMany({
    where: {
      active: true,
      approvalStatus: "APPROVED",
      pricingIntelligenceEnabled: true,
      pricingIntelligenceAddonStatus: "ACTIVE",
      properties: { some: { published: true } },
    },
    select: { id: true, name: true },
    take: 100,
  });

  let hostsProcessed = 0;
  const errors: string[] = [];

  for (const host of hosts) {
    const recent = await prisma.pricingIntelligenceRun.findFirst({
      where: {
        hostId: host.id,
        status: "COMPLETED",
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (recent) continue;

    try {
      await runPricingIntelligenceForHost({
        hostId: host.id,
        trigger: "MONTHLY_CRON",
      });
      hostsProcessed += 1;
    } catch (e) {
      errors.push(
        `${host.name}: ${e instanceof Error ? e.message : "failed"}`,
      );
    }
  }

  return { skipped: false, hostsProcessed, errors };
}
