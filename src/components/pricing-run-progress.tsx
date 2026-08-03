"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type ClientAgentStep = {
  id: string;
  name: string;
  agent: string;
  status: "pending" | "running" | "done" | "skipped" | "failed";
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  detail?: string;
};

type Props = {
  runId: string;
  initialStatus: string;
  initialSteps: ClientAgentStep[];
};

/**
 * Live multi-agent pipeline progress. Polls while RUNNING.
 */
export function PricingRunProgress({
  runId,
  initialStatus,
  initialSteps,
}: Props) {
  const router = useRouter();
  // State is seeded from server props; remount via key when runId/status changes.
  // Live updates come only from the poll effect below.
  const [status, setStatus] = useState(initialStatus);
  const [steps, setSteps] = useState(initialSteps);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "RUNNING" && status !== "PENDING") return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/pricing-runs/${runId}/status`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          status: string;
          steps: ClientAgentStep[];
          error?: string | null;
        };
        if (cancelled) return;
        setStatus(data.status);
        setSteps(data.steps || []);
        setError(data.error || null);
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          router.refresh();
        }
      } catch {
        /* ignore transient poll errors */
      }
    };

    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [runId, status, router]);

  const doneCount = steps.filter(
    (s) => s.status === "done" || s.status === "skipped",
  ).length;
  const running = status === "RUNNING" || status === "PENDING";

  return (
    <div className="rounded-3xl border border-bonnet/20 bg-gradient-to-br from-petal/50 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-bonnet">
            Multi-agent pipeline
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {running
              ? "Working through collect → market brief → analyze → critique → recommend. This is thorough on purpose (~30–90s with LLM)."
              : status === "COMPLETED"
                ? "Pipeline finished. Review recommendations below."
                : status === "FAILED"
                  ? "Pipeline failed — see error."
                  : status}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            running && "bg-amber-100 text-amber-950",
            status === "COMPLETED" && "bg-emerald-100 text-emerald-900",
            status === "FAILED" && "bg-red-100 text-red-900",
          )}
        >
          {running
            ? `Running · ${doneCount}/${steps.length || 6}`
            : status}
        </span>
      </div>

      {running ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-bonnet transition-all duration-500"
            style={{
              width: `${Math.max(8, (doneCount / Math.max(1, steps.length)) * 100)}%`,
            }}
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-900">
          {error}
        </p>
      ) : null}

      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={cn(
              "rounded-2xl border px-3 py-2.5 text-sm",
              s.status === "running" &&
                "border-amber-200 bg-amber-50/80 ring-1 ring-amber-100",
              s.status === "done" && "border-emerald-100 bg-emerald-50/40",
              s.status === "skipped" && "border-stone-100 bg-stone-50",
              s.status === "failed" && "border-red-200 bg-red-50",
              s.status === "pending" && "border-stone-100 bg-white",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-stone-500 ring-1 ring-stone-200">
                {i + 1}
              </span>
              <span className="font-medium text-stone-900">{s.name}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                {s.agent}
              </span>
              <span
                className={cn(
                  "ml-auto text-[10px] font-semibold uppercase",
                  s.status === "running" && "text-amber-800",
                  s.status === "done" && "text-emerald-800",
                  s.status === "skipped" && "text-stone-500",
                  s.status === "failed" && "text-red-800",
                  s.status === "pending" && "text-stone-400",
                )}
              >
                {s.status}
              </span>
            </div>
            {s.summary ? (
              <p className="mt-1.5 pl-8 text-xs leading-relaxed text-stone-600">
                {s.summary}
              </p>
            ) : null}
            {s.detail && (s.status === "done" || s.status === "running") ? (
              <details className="mt-1 pl-8">
                <summary className="cursor-pointer text-[11px] font-medium text-bonnet">
                  Details
                </summary>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-white/80 p-2 text-[10px] text-stone-600">
                  {s.detail}
                </pre>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
