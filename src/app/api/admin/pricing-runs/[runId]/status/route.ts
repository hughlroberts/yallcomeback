import { NextResponse } from "next/server";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initialAgentSteps } from "@/lib/pricing-intelligence/steps";

/**
 * Poll multi-agent pipeline progress for a research run.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const access = await requireHostAdmin();
  if (!access) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { runId } = await ctx.params;
  const run = await prisma.pricingIntelligenceRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      hostId: true,
      status: true,
      error: true,
      agentStepsJson: true,
      completedAt: true,
    },
  });
  if (!run) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!access.isPlatform && access.hostId !== run.hostId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let steps = initialAgentSteps();
  try {
    const parsed = JSON.parse(run.agentStepsJson || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) steps = parsed;
  } catch {
    /* keep defaults */
  }

  return NextResponse.json({
    status: run.status,
    error: run.error,
    completedAt: run.completedAt,
    steps,
  });
}
