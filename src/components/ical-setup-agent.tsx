"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  connectIcalFeed,
  previewIcalPaste,
  type IcalFeedPreview,
} from "@/app/actions/ical-setup";
import {
  deleteIcalConnection,
  syncIcalNow,
} from "@/app/actions/properties";
import { CopyTextButton } from "@/components/copy-text-button";
import { Button, Label, Textarea } from "@/components/ui";
import { ICAL_SITES, type IcalSiteId } from "@/lib/ical-setup";

export type IcalSetupConnection = {
  id: string;
  name: string;
  importUrl: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

type Props = {
  propertyId: string;
  exportUrl: string | null;
  connections: IcalSetupConnection[];
  /** LLM extract of messy paste — platform hosts only. */
  agentEnabled: boolean;
};

const SITE_IDS: IcalSiteId[] = ["airbnb", "vrbo"];

export function IcalSetupAgent({
  propertyId,
  exportUrl,
  connections,
  agentEnabled,
}: Props) {
  const router = useRouter();
  const [sites, setSites] = useState<IcalSiteId[]>(["airbnb", "vrbo"]);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<IcalFeedPreview[] | null>(null);
  const [usedLlm, setUsedLlm] = useState(false);
  const [pending, startTransition] = useTransition();

  const imports = connections.filter((c) => c.importUrl);
  const guides = useMemo(
    () => ICAL_SITES.filter((s) => sites.includes(s.id)),
    [sites],
  );

  function toggleSite(id: IcalSiteId) {
    setSites((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((s) => s !== id);
        return next.length === 0 ? prev : next;
      }
      return [...prev, id];
    });
  }

  function runPreview() {
    setError(null);
    setCandidates(null);
    setUsedLlm(false);
    setStep("Looking for a calendar link…");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("propertyId", propertyId);
      fd.set("paste", paste);
      const res = await previewIcalPaste(fd);
      if (!res.ok) {
        setError(res.error);
        setStep(null);
        return;
      }
      setCandidates(res.candidates);
      setUsedLlm(res.usedLlm);
      setStep(null);
    });
  }

  function runConnect(candidate: IcalFeedPreview) {
    setError(null);
    setStep(`Connecting ${candidate.sourceName} and pulling busy nights…`);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("propertyId", propertyId);
      fd.set("importUrl", candidate.url);
      fd.set("name", candidate.sourceName);
      const res = await connectIcalFeed(fd);
      if (!res.ok) {
        setError(res.error);
        setStep(null);
        router.refresh();
        return;
      }
      setPaste("");
      setCandidates(null);
      setStep(
        res.eventCount > 0
          ? `Connected ${res.name} — ${res.eventCount} busy period${res.eventCount === 1 ? "" : "s"} on this calendar.`
          : `Connected ${res.name}. No busy nights in that feed yet — new bookings will show after the next sync.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-hairline bg-porcelain p-6 shadow-sm sm:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-bonnet">
          {agentEnabled ? "Setup agent" : "Calendar sync"}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
          Booked in one place = booked everywhere
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Two-way iCal. A night booked on Airbnb or VRBO shows busy here, and a
          night booked here shows busy there. We cannot log into those sites
          for you — calendar links live in host settings. Do both steps.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {SITE_IDS.map((id) => {
          const on = sites.includes(id);
          const label = id === "airbnb" ? "Airbnb" : "VRBO";
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleSite(id)}
              className={
                on
                  ? "rounded-full bg-bonnet px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      <ol className="mt-6 space-y-4">
        <li className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-sm font-semibold text-stone-900">
            1. Push Yall Come Back into {guides.map((g) => g.label).join(" / ")}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Copy this URL, then import it as a calendar on those sites so they
            block nights booked here.
          </p>
          {exportUrl ? (
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-800 ring-1 ring-stone-200">
                {exportUrl}
              </code>
              <CopyTextButton text={exportUrl} label="Copy URL" />
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-800">
              No export feed yet. Save this listing, then reopen this panel.
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {guides.map((g) => (
              <li key={g.id}>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {g.label}
                </p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-stone-600">
                  {g.importSteps.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </li>

        <li className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-sm font-semibold text-stone-900">
            2. Pull {guides.map((g) => g.label).join(" / ")} into Yall Come Back
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {agentEnabled
              ? "Paste the .ics link, or paste the host-settings page text that contains it. We find the feed, check it, and connect it."
              : "Paste the Export calendar / .ics URL from host settings."}
          </p>
          <ul className="mt-3 space-y-3">
            {guides.map((g) => (
              <li key={g.id}>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {g.label}
                </p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-stone-600">
                  {g.exportSteps.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Label htmlFor="ical-paste">Calendar link or page text</Label>
            <Textarea
              id="ical-paste"
              rows={4}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="https://www.airbnb.com/calendar/ical/….ics?s=…"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={pending || !paste.trim()}
              onClick={runPreview}
            >
              {pending && !candidates ? "Reading…" : "Find calendar link"}
            </Button>
          </div>
        </li>
      </ol>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {step ? (
        <p className="mt-4 text-sm font-medium text-bonnet">{step}</p>
      ) : null}

      {candidates && candidates.length > 0 ? (
        <div className="mt-4 space-y-2">
          {usedLlm ? (
            <p className="text-xs text-ink-muted">
              Found in the text you pasted.
            </p>
          ) : null}
          {candidates.map((c) => (
            <div
              key={c.url}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink">{c.sourceName}</p>
                <p className="text-sm text-ink-muted">
                  {c.eventCount} busy period{c.eventCount === 1 ? "" : "s"} in
                  the feed
                  {c.sample.length > 0 ? ` · ${c.sample.join(", ")}` : ""}
                </p>
              </div>
              <Button
                type="button"
                disabled={pending}
                onClick={() => runConnect(c)}
              >
                Connect and sync
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {imports.length > 0 ? (
        <div className="mt-6 border-t border-hairline pt-5">
          <h3 className="text-sm font-semibold text-ink">Connected calendars</h3>
          <div className="mt-3 space-y-2">
            {imports.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 bg-white p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    Last sync: {c.lastSyncedAt || "never"}
                    {c.lastSyncError ? ` · Error: ${c.lastSyncError}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={syncIcalNow}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="propertyId" value={propertyId} />
                    <Button type="submit" variant="ghost">
                      Sync now
                    </Button>
                  </form>
                  <form action={deleteIcalConnection}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="propertyId" value={propertyId} />
                    <Button type="submit" variant="danger">
                      Remove
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
