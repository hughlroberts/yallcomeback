import { prisma } from "@/lib/db";

export type AgentStepStatus =
  | "pending"
  | "running"
  | "done"
  | "skipped"
  | "failed";

export type AgentStep = {
  id: string;
  name: string;
  agent: "collector" | "market" | "analyst" | "recommender" | "executor";
  status: AgentStepStatus;
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  detail?: string;
};

export const PIPELINE_STEPS: Omit<AgentStep, "status">[] = [
  {
    id: "collect_internal",
    name: "Collect internal data & peer comps",
    agent: "collector",
  },
  {
    id: "market_brief",
    name: "Market research brief (LLM)",
    agent: "market",
  },
  {
    id: "analyze_rates",
    name: "Analyze rates vs balanced comps",
    agent: "analyst",
  },
  {
    id: "llm_critique",
    name: "Analyst critique & refine (LLM)",
    agent: "analyst",
  },
  {
    id: "recommend",
    name: "Write recommendations & experiments (LLM)",
    agent: "recommender",
  },
  {
    id: "finalize",
    name: "Assemble report for human review",
    agent: "executor",
  },
];

export function initialAgentSteps(): AgentStep[] {
  return PIPELINE_STEPS.map((s) => ({ ...s, status: "pending" as const }));
}

export async function loadAgentSteps(runId: string): Promise<AgentStep[]> {
  const run = await prisma.pricingIntelligenceRun.findUnique({
    where: { id: runId },
    select: { agentStepsJson: true },
  });
  try {
    const parsed = JSON.parse(run?.agentStepsJson || "[]") as AgentStep[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : initialAgentSteps();
  } catch {
    return initialAgentSteps();
  }
}

export async function markStep(
  runId: string,
  stepId: string,
  patch: Partial<AgentStep>,
): Promise<AgentStep[]> {
  const steps = await loadAgentSteps(runId);
  const next = steps.map((s) =>
    s.id === stepId
      ? {
          ...s,
          ...patch,
        }
      : s,
  );
  await prisma.pricingIntelligenceRun.update({
    where: { id: runId },
    data: { agentStepsJson: JSON.stringify(next) },
  });
  return next;
}

export async function beginStep(runId: string, stepId: string) {
  return markStep(runId, stepId, {
    status: "running",
    startedAt: new Date().toISOString(),
    summary: undefined,
    detail: undefined,
  });
}

export async function completeStep(
  runId: string,
  stepId: string,
  summary: string,
  detail?: string,
) {
  return markStep(runId, stepId, {
    status: "done",
    completedAt: new Date().toISOString(),
    summary,
    detail: detail?.slice(0, 4000),
  });
}

export async function skipStep(
  runId: string,
  stepId: string,
  summary: string,
) {
  return markStep(runId, stepId, {
    status: "skipped",
    completedAt: new Date().toISOString(),
    summary,
  });
}

export async function failStep(
  runId: string,
  stepId: string,
  summary: string,
) {
  return markStep(runId, stepId, {
    status: "failed",
    completedAt: new Date().toISOString(),
    summary,
  });
}
