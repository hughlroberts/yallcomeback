import { prisma } from "@/lib/db";
import type { PricingRunTrigger, PricingRecBasis } from "@prisma/client";
import { isPricingIntelligenceEnabled } from "@/lib/platform-features";
import { collectHostPricingData } from "./collector";
import { analyzePricing, buildReportMarkdown } from "./analyst";

export type RunPricingOptions = {
  hostId: string;
  trigger?: PricingRunTrigger;
  /** Lookback days for internal stats (default 90). */
  lookbackDays?: number;
};

/**
 * Full agent loop for one host: collect → analyze → recommend (no auto-apply).
 * Platform product only.
 */
export async function runPricingIntelligenceForHost(
  opts: RunPricingOptions,
): Promise<{ runId: string; recommendationCount: number }> {
  if (!isPricingIntelligenceEnabled()) {
    throw new Error(
      "Pricing intelligence is a hosted-platform feature and is disabled on this deploy.",
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
    },
  });

  try {
    const bundle = await collectHostPricingData(
      opts.hostId,
      periodStart,
      periodEnd,
    );
    const suggestions = analyzePricing(bundle);
    const report = buildReportMarkdown(bundle, suggestions);

    await prisma.pricingRecommendation.createMany({
      data: suggestions.map((s) => ({
        runId: run.id,
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
        evidenceJson: JSON.stringify(s.evidence),
        status: s.doNothing ? "SKIPPED" : "PENDING",
      })),
    });

    await prisma.pricingIntelligenceRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        collectorJson: JSON.stringify(bundle),
        analystJson: JSON.stringify({
          suggestionCount: suggestions.length,
          pending: suggestions.filter((s) => !s.doNothing).length,
        }),
        reportMarkdown: report,
      },
    });

    return {
      runId: run.id,
      recommendationCount: suggestions.filter((s) => !s.doNothing).length,
    };
  } catch (e) {
    await prisma.pricingIntelligenceRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: e instanceof Error ? e.message : "Unknown error",
      },
    });
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
