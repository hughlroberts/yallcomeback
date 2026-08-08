"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  saveServicesBlocks,
  uploadServicesImage,
} from "@/app/actions/host";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { ServicesPageRenderer } from "@/components/services-page-renderer";
import {
  createBlock,
  type ServicesBlock,
  type ServicesBlockType,
} from "@/lib/services-blocks";
import { cn } from "@/lib/utils";

type Props = {
  hostId: string;
  basePath: string;
  pageTitle: string;
  initialBlocks: ServicesBlock[];
  /** Guest site path to stay on after save, e.g. /h/cherokee-landing/services */
  returnTo: string;
};

/**
 * Real-time Services editor on the host demo/guest site.
 * Edits update the live preview above; Save writes to the DB.
 */
export function ServicesPageLiveEditor({
  hostId,
  basePath,
  pageTitle,
  initialBlocks,
  returnTo,
}: Props) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<ServicesBlock[]>(initialBlocks);
  const [expandedId, setExpandedId] = useState<string | null>(
    initialBlocks.find((b) => b.type === "card")?.id ?? null,
  );
  const [pending, startTransition] = useTransition();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function updateBlock(id: string, patch: Partial<ServicesBlock>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
    setSavedFlash(false);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (expandedId === id) setExpandedId(null);
    setSavedFlash(false);
  }

  function addBlock(type: ServicesBlockType) {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setExpandedId(block.id);
    setSavedFlash(false);
  }

  /** Quick fill for a ~5-boat fleet (Cherokee, etc.) */
  function addFiveBoatCards() {
    const newCards = Array.from({ length: 5 }, (_, i) => {
      const b = createBlock("card");
      b.content = `Boat ${i + 1}`;
      b.secondary =
        "Capacity, length, features, and what’s included for guests.";
      b.price = "Half day $— · Full day $—";
      return b;
    });
    setBlocks((prev) => [...prev, ...newCards]);
    setExpandedId(newCards[0]!.id);
    setSavedFlash(false);
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
    setSavedFlash(false);
  }

  async function onPickImage(blockId: string, file: File | null) {
    if (!file) return;
    setError(null);
    setUploadingId(blockId);
    const fd = new FormData();
    fd.set("hostId", hostId);
    fd.set("file", file);
    try {
      const result = await uploadServicesImage(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const block = blocks.find((b) => b.id === blockId);
      if (block?.type === "image") {
        updateBlock(blockId, { imageUrl: result.url, content: result.url });
      } else {
        updateBlock(blockId, { imageUrl: result.url });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingId(null);
    }
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

  const cardCount = blocks.filter((b) => b.type === "card").length;

  return (
    <div className="space-y-8">
      {/* Sticky edit bar */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-sky-200 bg-sky-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-sky-950">
              Editing live — {pageTitle || "Services"}
            </p>
            <p className="text-xs text-sky-900/80">
              Changes show below instantly. Guests only see them after you
              save. {cardCount} boat/service card{cardCount === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => addBlock("card")}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Add boat / card
            </Button>
            {cardCount < 5 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={addFiveBoatCards}
                className="gap-1.5"
              >
                <Plus className="size-4" />
                Add 5 boat slots
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => addBlock("image")}
              className="gap-1.5"
            >
              <ImagePlus className="size-4" />
              Add image
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={pending}
              className="gap-1.5"
            >
              <Save className="size-4" />
              {pending ? "Saving…" : "Save page"}
            </Button>
          </div>
        </div>
        {savedFlash ? (
          <p className="mt-2 text-sm font-medium text-emerald-800">
            Saved — guests will see this version.
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm font-medium text-amber-900">{error}</p>
        ) : null}
      </div>

      {/* Live guest preview */}
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
          Guest preview (updates as you type)
        </p>
        <ServicesPageRenderer blocks={blocks} basePath={basePath} />
      </div>

      {/* Block editors */}
      <div className="space-y-3 border-t border-stone-200 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Edit blocks
            </h2>
            <p className="text-sm text-stone-500">
              Expand a card to change photo, name, details, and pricing.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["heading", "Heading"],
                ["text", "Text"],
                ["card", "Card"],
                ["list", "List"],
                ["image", "Image"],
                ["button", "Button"],
                ["divider", "Divider"],
              ] as const
            ).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-600 hover:border-sky-300 hover:text-sky-800"
              >
                + {label}
              </button>
            ))}
          </div>
        </div>

        {blocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-500">
            No blocks yet.{" "}
            <button
              type="button"
              className="font-semibold text-sky-800 underline"
              onClick={() => addBlock("card")}
            >
              Add your first boat card
            </button>
          </div>
        ) : null}

        <ul className="space-y-3">
          {blocks.map((b, index) => {
            const open = expandedId === b.id;
            return (
              <li
                key={b.id}
                className={cn(
                  "rounded-2xl border bg-white shadow-sm",
                  open ? "border-sky-300 ring-2 ring-sky-100" : "border-stone-200",
                )}
              >
                <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : b.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                      {b.type === "card" ? "boat / card" : b.type}
                    </span>
                    <span className="truncate text-sm font-medium text-stone-800">
                      {b.type === "divider"
                        ? "Divider"
                        : b.content?.trim() ||
                          (b.type === "image" ? "Image" : "Untitled")}
                    </span>
                    {b.type === "card" && b.price ? (
                      <span className="hidden truncate text-xs text-stone-500 sm:inline">
                        · {b.price}
                      </span>
                    ) : null}
                  </button>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(b.id, -1)}
                      disabled={index === 0}
                      className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(b.id, 1)}
                      disabled={index === blocks.length - 1}
                      className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
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

                {open ? (
                  <div className="space-y-3 border-t border-stone-100 px-4 py-4">
                    {(b.type === "heading" || b.type === "text") && (
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
                    )}

                    {b.type === "card" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs text-stone-500">
                            Boat / service name
                          </Label>
                          <Input
                            value={b.content}
                            placeholder="e.g. 24ft Crest pontoon"
                            onChange={(e) =>
                              updateBlock(b.id, { content: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs text-stone-500">
                            Pricing
                          </Label>
                          <Input
                            value={b.price || ""}
                            placeholder="Half day $175 · Full day $275"
                            onChange={(e) =>
                              updateBlock(b.id, { price: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs text-stone-500">
                            Details
                          </Label>
                          <Textarea
                            rows={3}
                            value={b.secondary || ""}
                            placeholder="Capacity, features, what’s included…"
                            onChange={(e) =>
                              updateBlock(b.id, { secondary: e.target.value })
                            }
                          />
                        </div>
                        <ImageUploadField
                          blockId={b.id}
                          imageUrl={b.imageUrl}
                          uploading={uploadingId === b.id}
                          fileRef={(el) => {
                            fileRefs.current[b.id] = el;
                          }}
                          onPick={(file) => onPickImage(b.id, file)}
                          onClear={() => updateBlock(b.id, { imageUrl: "" })}
                          onUrlChange={(url) =>
                            updateBlock(b.id, { imageUrl: url })
                          }
                        />
                      </div>
                    )}

                    {b.type === "list" && (
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
                    )}

                    {b.type === "image" && (
                      <div className="grid gap-3">
                        <ImageUploadField
                          blockId={b.id}
                          imageUrl={b.imageUrl || b.content}
                          uploading={uploadingId === b.id}
                          fileRef={(el) => {
                            fileRefs.current[b.id] = el;
                          }}
                          onPick={(file) => onPickImage(b.id, file)}
                          onClear={() =>
                            updateBlock(b.id, { imageUrl: "", content: "" })
                          }
                          onUrlChange={(url) =>
                            updateBlock(b.id, {
                              imageUrl: url,
                              content: url,
                            })
                          }
                        />
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
                    )}

                    {b.type === "button" && (
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
                            placeholder="/about#contact"
                            onChange={(e) =>
                              updateBlock(b.id, { secondary: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {b.type === "divider" && (
                      <p className="text-xs text-stone-400">
                        Horizontal line on the guest page.
                      </p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={save} disabled={pending} className="gap-1.5">
            <Save className="size-4" />
            {pending ? "Saving…" : "Save page"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImageUploadField({
  blockId,
  imageUrl,
  uploading,
  fileRef,
  onPick,
  onClear,
  onUrlChange,
}: {
  blockId: string;
  imageUrl?: string;
  uploading: boolean;
  fileRef: (el: HTMLInputElement | null) => void;
  onPick: (file: File | null) => void;
  onClear: () => void;
  onUrlChange: (url: string) => void;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label className="text-xs text-stone-500">Photo</Label>
      <div className="flex flex-wrap items-start gap-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="h-28 w-40 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-28 w-40 items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 text-xs text-stone-400">
            No photo
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            id={`svc-img-${blockId}`}
            onChange={(e) => {
              onPick(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={uploading}
              className="gap-1.5"
              onClick={() =>
                document.getElementById(`svc-img-${blockId}`)?.click()
              }
            >
              <Upload className="size-4" />
              {uploading ? "Uploading…" : "Upload photo"}
            </Button>
            {imageUrl ? (
              <button
                type="button"
                onClick={onClear}
                className="text-sm font-medium text-stone-500 underline-offset-2 hover:underline"
              >
                Remove photo
              </button>
            ) : null}
          </div>
          <Input
            value={imageUrl || ""}
            placeholder="Or paste image URL"
            onChange={(e) => onUrlChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
