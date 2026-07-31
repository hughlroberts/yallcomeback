"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePropertyImage } from "@/app/actions/properties";
import { cn } from "@/lib/utils";

/**
 * Two-step photo delete: first click arms (turns red), second click removes.
 * Arming resets if you click elsewhere or wait a few seconds.
 */
export function ConfirmRemovePhotoButton({
  imageId,
  propertyId,
}: {
  imageId: string;
  propertyId: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!armed) return;
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setArmed(false);
      }
    };
    const t = window.setTimeout(() => setArmed(false), 4000);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [armed]);

  function onClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", imageId);
      fd.set("propertyId", propertyId);
      await deletePropertyImage(fd);
      router.refresh();
    });
  }

  return (
    <button
      ref={btnRef}
      type="button"
      disabled={pending}
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium shadow-sm transition-colors disabled:opacity-50",
        armed
          ? "bg-red-600 text-white hover:bg-red-700"
          : "border border-stone-300 bg-white/95 text-stone-700 hover:bg-stone-50",
      )}
    >
      {pending ? "Removing…" : armed ? "Click again to remove" : "Remove"}
    </button>
  );
}
