import { runCalendarChecks } from "./calendar";
import { runListingChecks } from "./listings";
import { runSystemChecks } from "./system";
import {
  RESIDUAL_RISKS,
  type HealthFinding,
  type HealthReport,
  type HealthSeverity,
  type HealthSummary,
  type HealthTab,
  type SystemStatusRow,
} from "./types";

function summarize(findings: HealthFinding[]): HealthSummary {
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const f of findings) {
    if (f.severity === "critical") critical += 1;
    else if (f.severity === "warning") warning += 1;
    else if (f.severity === "info") info += 1;
  }
  return {
    critical,
    warning,
    info,
    ok: critical === 0 && warning === 0,
    checkedAt: new Date().toISOString(),
  };
}

function severityRank(s: HealthSeverity): number {
  switch (s) {
    case "critical":
      return 0;
    case "warning":
      return 1;
    case "info":
      return 2;
    default:
      return 3;
  }
}

export async function runHealthChecks(opts?: {
  tab?: HealthTab;
  hostId?: string;
}): Promise<HealthReport> {
  const tab = opts?.tab || "overview";
  const hostId = opts?.hostId || undefined;

  let findings: HealthFinding[] = [];
  let systemRows: SystemStatusRow[] | undefined;

  if (tab === "overview" || tab === "calendar") {
    findings = findings.concat(await runCalendarChecks({ hostId }));
  }
  if (tab === "overview" || tab === "listings") {
    findings = findings.concat(await runListingChecks({ hostId }));
  }
  if (tab === "overview" || tab === "system") {
    const sys = await runSystemChecks();
    findings = findings.concat(sys.findings);
    if (tab === "system" || tab === "overview") {
      systemRows = sys.rows;
    }
  }

  findings.sort((a, b) => {
    const sr = severityRank(a.severity) - severityRank(b.severity);
    if (sr !== 0) return sr;
    return a.title.localeCompare(b.title);
  });

  return {
    summary: summarize(findings),
    findings,
    systemRows,
    residualRisks: RESIDUAL_RISKS,
  };
}

export function parseHealthTab(raw: string | undefined): HealthTab {
  if (
    raw === "calendar" ||
    raw === "listings" ||
    raw === "system" ||
    raw === "overview"
  ) {
    return raw;
  }
  return "overview";
}
