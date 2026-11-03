"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProperty } from "@/app/actions/properties";
import {
  archiveListing,
  pauseListing,
  restoreListing,
  resumeListing,
  type ListingLifecycleResult,
} from "@/app/actions/listing-lifecycle";
import { deleteConfirmMatches } from "@/lib/listing-lifecycle";
import { cn } from "@/lib/utils";

type Action = "pause" | "resume" | "archive" | "restore" | "delete";

const ACTIONS: Record<Action, (fd: FormData) => Promise<ListingLifecycleResult>> = {
  pause: pauseListing,
  resume: resumeListing,
  archive: archiveListing,
  restore: restoreListing,
  delete: deleteProperty,
};

const btn =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60";
const dangerBtn =
  "inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-60";

/**
 * Pause / Resume, Archive / Restore and Delete for one listing.
 * The server checks brand scope and access level again for every action.
 */
export function ListingLifecycleActions({
  propertyId,
  title,
  published,
  archived,
  canRemove,
  showPauseResume = true,
  afterDeleteHref = "/admin/properties",
}: {
  propertyId: string;
  title: string;
  published: boolean;
  archived: boolean;
  /** Owner, full co-host, or Platform admin. */
  canRemove: boolean;
  showPauseResume?: boolean;
  afterDeleteHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deleteOpen = confirm === "delete";

  // Open / close the native modal dialog to match state (syncs a DOM API, no setState).
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (deleteOpen && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!deleteOpen && d.open) {
      d.close();
    }
  }, [deleteOpen]);

  function closeDelete() {
    setConfirm(null);
    setTyped("");
  }

  function run(action: Action) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", propertyId);
      if (action === "delete") fd.set("confirmTitle", typed);
      let result: ListingLifecycleResult;
      try {
        result = await ACTIONS[action](fd);
      } catch {
        result = { ok: false, error: "Could not update this listing. Try again." };
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      closeDelete();
      if (action === "delete") {
        router.push(afterDeleteHref);
      }
      router.refresh();
    });
  }

  const typedOk = deleteConfirmMatches(title, typed);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        {showPauseResume && !archived ? (
          published ? (
            <button
              type="button"
              className={btn}
              disabled={pending}
              onClick={() => run("pause")}
              title="Stop new bookings and hide this listing. Your data stays."
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              className={btn}
              disabled={pending}
              onClick={() => run("resume")}
              title="Take bookings again"
            >
              Resume
            </button>
          )
        ) : null}
        {canRemove && !archived ? (
          <button
            type="button"
            className={btn}
            disabled={pending}
            onClick={() => {
              setError(null);
              setConfirm(confirm === "archive" ? null : "archive");
            }}
            aria-expanded={confirm === "archive"}
          >
            Archive
          </button>
        ) : null}
        {canRemove && archived ? (
          <button
            type="button"
            className={btn}
            disabled={pending}
            onClick={() => run("restore")}
            title="Move back to your listings as paused"
          >
            Restore
          </button>
        ) : null}
        {canRemove ? (
          <button
            type="button"
            className={dangerBtn}
            disabled={pending}
            onClick={() => {
              setError(null);
              setTyped("");
              setConfirm(confirm === "delete" ? null : "delete");
            }}
            aria-expanded={confirm === "delete"}
          >
            Delete
          </button>
        ) : null}
      </div>

      {confirm === "archive" ? (
        <div
          role="group"
          aria-label="Confirm archive"
          className="mt-2 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <p>
            Archive this listing? Guests cannot find it or book it. Your stays,
            photos and prices stay here. Stays that are already booked do not
            change.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={btn}
              disabled={pending}
              onClick={() => run("archive")}
            >
              Archive listing
            </button>
            <button type="button" className={btn} onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          closeDelete();
        }}
        className="w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-red-200 bg-white p-5 text-sm text-slate-800 shadow-xl backdrop:bg-slate-900/50"
      >
        {deleteOpen ? (
          <form
            method="dialog"
            onSubmit={(e) => {
              e.preventDefault();
              if (typedOk && !pending) run("delete");
            }}
          >
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Are you sure?
            </h2>
            <p className="mt-2">
              Delete removes <strong>{title}</strong>, its photos, prices and
              calendar. You cannot undo this. To keep the data, archive the
              listing.
            </p>
            <label htmlFor={inputId} className="mt-3 block text-xs font-medium">
              Type the listing name to confirm
            </label>
            <input
              id={inputId}
              name="confirmTitle"
              autoComplete="off"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
            {error ? (
              <p role="alert" className="mt-2 text-xs font-medium text-bonnet">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className={btn}
                onClick={() => {
                  setError(null);
                  closeDelete();
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={cn(dangerBtn, "bg-red-600 text-white hover:bg-red-700")}
                disabled={pending || !typedOk}
              >
                Confirm delete
              </button>
            </div>
          </form>
        ) : null}
      </dialog>

      {error && !deleteOpen ? (
        <p role="alert" className="mt-2 max-w-md text-xs font-medium text-bonnet">
          {error}
        </p>
      ) : null}
    </div>
  );
}
