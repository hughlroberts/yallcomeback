"use client";

/**
 * Legacy admin-side services builder.
 * Primary editing is now on the guest site via ServicesPageLiveEditor.
 * Kept for optional reuse; brand admin links to the live page instead.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  Pencil,
} from "lucide-react";
import { saveServicesBlocks } from "@/app/actions/host";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { ServicesPageRenderer } from "@/components/services-page-renderer";
import {
  SERVICES_BLOCK_CATALOG,
  createBlock,
  type ServicesBlock,
  type ServicesBlockType,
} from "@/lib/services-blocks";
import { cn } from "@/lib/utils";

type Props = {
  hostId: string;
  returnTo: string;
  initialBlocks: ServicesBlock[];
  pageTitle: string;
};

export function ServicesPageBuilder({
  hostId,
  returnTo,
  initialBlocks,
  pageTitle,
}: Props) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<ServicesBlock[]>(initialBlocks);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalog = useMemo(() => SERVICES_BLOCK_CATALOG, []);

  function updateBlock(id: string, patch: Partial<ServicesBlock>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function addBlock(type: ServicesBlockType) {
    setBlocks((prev) => [...prev, createBlock(type)]);
    setMode("edit");
  }

  function move(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item!);
      return next;
    });
  }

  function onDragStart(id: string) {
    setDragId(id);
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (id !== overId) setOverId(id);
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === dragId);
      const to = prev.findIndex((b) => b.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
    setDragId(null);
    setOverId(null);
  }

  function save() {
    setError(null);
    setSavedFlash(false);
    const fd = new FormData();
    fd.set("hostId", hostId);
    fd.set("returnTo", returnTo);
    fd.set("blocksJson", JSON.stringify(blocks));
    startTransition(async () => {
      try {
        await saveServicesBlocks(fd);
        setSavedFlash(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Services page builder
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Prefer editing live on the guest page. Page title:{" "}
            <strong>{pageTitle || "Other services"}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              mode === "edit"
                ? "bg-bonnet text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200",
            )}
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              mode === "preview"
                ? "bg-bonnet text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200",
            )}
          >
            <Eye className="size-3.5" /> Preview
          </button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save page"}
          </Button>
        </div>
      </div>

      {savedFlash ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Services page saved.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
          Add a block
        </p>
        <div className="flex flex-wrap gap-2">
          {catalog.map((c) => (
            <button
              key={c.type}
              type="button"
              onClick={() => addBlock(c.type)}
              title={c.hint}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm hover:border-bonnet/40 hover:text-bonnet"
            >
              <Plus className="size-3.5" />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "preview" ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
          <p className="mb-6 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Guest preview
          </p>
          <ServicesPageRenderer blocks={blocks} basePath="" />
        </div>
      ) : (
        <ul className="space-y-3">
          {blocks.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-500">
              No blocks yet. Add a heading, boat card, or text above.
            </li>
          ) : null}
          {blocks.map((b) => (
            <li
              key={b.id}
              draggable
              onDragStart={() => onDragStart(b.id)}
              onDragOver={(e) => onDragOver(e, b.id)}
              onDrop={() => onDrop(b.id)}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={cn(
                "rounded-2xl border bg-white p-4 shadow-sm transition",
                dragId === b.id && "opacity-60",
                overId === b.id && dragId !== b.id && "border-bonnet ring-2 ring-bonnet/20",
                overId !== b.id && "border-stone-200",
              )}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="cursor-grab text-stone-400 active:cursor-grabbing">
                  <GripVertical className="size-5" />
                </span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                  {b.type}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(b.id, -1)}
                    className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
                    aria-label="Move up"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(b.id, 1)}
                    className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
                    aria-label="Move down"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(b.id)}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                    aria-label="Remove"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {b.type === "heading" || b.type === "text" ? (
                <div className="space-y-1">
                  <Label className="text-xs text-stone-500">
                    {b.type === "heading" ? "Heading" : "Text"}
                  </Label>
                  {b.type === "heading" ? (
                    <Input
                      value={b.content}
                      onChange={(e) =>
                        updateBlock(b.id, { content: e.target.value })
                      }
                    />
                  ) : (
                    <Textarea
                      rows={3}
                      value={b.content}
                      onChange={(e) =>
                        updateBlock(b.id, { content: e.target.value })
                      }
                    />
                  )}
                </div>
              ) : null}

              {b.type === "card" ? (
                <div className="grid gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Title</Label>
                    <Input
                      value={b.content}
                      onChange={(e) =>
                        updateBlock(b.id, { content: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Pricing</Label>
                    <Input
                      value={b.price || ""}
                      placeholder="Half day $175 · Full day $275"
                      onChange={(e) =>
                        updateBlock(b.id, { price: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Details</Label>
                    <Textarea
                      rows={3}
                      value={b.secondary || ""}
                      onChange={(e) =>
                        updateBlock(b.id, { secondary: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Photo URL</Label>
                    <Input
                      value={b.imageUrl || ""}
                      placeholder="/uploads/… or https://…"
                      onChange={(e) =>
                        updateBlock(b.id, { imageUrl: e.target.value })
                      }
                    />
                  </div>
                </div>
              ) : null}

              {b.type === "list" ? (
                <div className="space-y-1">
                  <Label className="text-xs text-stone-500">
                    Items (one per line)
                  </Label>
                  <Textarea
                    rows={4}
                    value={b.content}
                    onChange={(e) =>
                      updateBlock(b.id, { content: e.target.value })
                    }
                  />
                </div>
              ) : null}

              {b.type === "image" ? (
                <div className="grid gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Image URL</Label>
                    <Input
                      value={b.imageUrl || b.content}
                      placeholder="https://… or /uploads/…"
                      onChange={(e) =>
                        updateBlock(b.id, {
                          imageUrl: e.target.value,
                          content: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">
                      Caption (optional)
                    </Label>
                    <Input
                      value={b.secondary || ""}
                      onChange={(e) =>
                        updateBlock(b.id, { secondary: e.target.value })
                      }
                    />
                  </div>
                </div>
              ) : null}

              {b.type === "button" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Label</Label>
                    <Input
                      value={b.content}
                      onChange={(e) =>
                        updateBlock(b.id, { content: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">
                      Link (URL or /about)
                    </Label>
                    <Input
                      value={b.secondary || ""}
                      placeholder="/about#contact or https://…"
                      onChange={(e) =>
                        updateBlock(b.id, { secondary: e.target.value })
                      }
                    />
                  </div>
                </div>
              ) : null}

              {b.type === "divider" ? (
                <p className="text-xs text-stone-400">
                  Horizontal line on the guest page.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
