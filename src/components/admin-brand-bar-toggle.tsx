"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * T25: on phones the brand tools fold into one row behind a "Brand" button so
 * the page content shows above the fold. From sm up they are always shown.
 * One copy of the controls in the DOM (no duplicate ids). `action` (the way
 * back to Platform admin) stays visible in the collapsed phone row.
 */
export function AdminBrandBarToggle({
  summary,
  action,
  children,
}: {
  summary: React.ReactNode;
  /** Shown in the phone row only; pass the same link in children for sm+. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-3 py-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6 sm:py-2.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0 flex-1 truncate text-sm text-amber-950">{summary}</div>
        {action ? <div className="shrink-0 sm:hidden">{action}</div> : null}
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300/80 bg-white px-2.5 py-1 text-xs font-semibold text-amber-950 sm:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          Brand
          <ChevronDown
            className={`size-3.5 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>
      <div
        id={panelId}
        className={`${open ? "flex" : "hidden"} flex-wrap items-center gap-2 pb-1 sm:flex sm:pb-0`}
      >
        {children}
      </div>
    </div>
  );
}
