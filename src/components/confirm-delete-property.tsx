"use client";

import { useState, useTransition } from "react";
import { deleteProperty } from "@/app/actions/properties";
import { Button, Input, Label } from "@/components/ui";

/**
 * Hidden danger zone: expand → type exact title → delete.
 * Two deliberate steps so listings are not one-click destroyed.
 */
export function ConfirmDeleteProperty({
  propertyId,
  propertyTitle,
}: {
  propertyId: string;
  propertyTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const match = typed.trim() === propertyTitle.trim();

  function onDelete() {
    if (!match) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", propertyId);
      await deleteProperty(fd);
    });
  }

  return (
    <div className="mt-10 border-t border-red-100 pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-stone-400 hover:text-red-700"
      >
        {open ? "Hide danger zone" : "Danger zone"}
      </button>
      {open ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50/80 p-4">
          <p className="text-sm font-semibold text-red-900">
            Permanently delete this listing
          </p>
          <p className="mt-1 text-xs text-red-800/90">
            This cannot be undone. Type the listing title exactly to enable
            delete:
          </p>
          <p className="mt-2 font-mono text-xs text-stone-700">
            {propertyTitle}
          </p>
          <div className="mt-3 max-w-md">
            <Label htmlFor="delete-confirm-title">Confirm title</Label>
            <Input
              id="delete-confirm-title"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              placeholder="Type full title"
            />
          </div>
          <Button
            type="button"
            variant="danger"
            disabled={!match || pending}
            onClick={onDelete}
            className="mt-3 !bg-red-600 !text-white hover:!bg-red-700 disabled:opacity-40"
          >
            {pending ? "Deleting…" : "Delete listing permanently"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
