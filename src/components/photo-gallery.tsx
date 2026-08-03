"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type Photo = { id: string; url: string; alt: string | null };

export function PhotoGallery({
  photos,
  title,
}: {
  photos: Photo[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const openAt = useCallback((i: number) => {
    setIndex(Math.max(0, Math.min(i, photos.length - 1)));
    setOpen(true);
  }, [photos.length]);

  const close = useCallback(() => setOpen(false), []);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[2/1] items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
        No photos yet
      </div>
    );
  }

  const main = photos[0];
  const rest = photos.slice(1, 5);
  const extra = Math.max(0, photos.length - 5);

  return (
    <div>
      <div className="grid gap-2 overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5 sm:grid-cols-4 sm:grid-rows-2 sm:min-h-[400px]">
        <button
          type="button"
          onClick={() => openAt(0)}
          className="relative aspect-[4/3] bg-stone-100 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bonnet sm:col-span-2 sm:row-span-2 sm:aspect-auto"
          aria-label={`View photo 1 of ${photos.length}: ${main.alt || title}`}
        >
          <Image
            src={main.url}
            alt={main.alt || title}
            fill
            className="object-cover transition group-hover:brightness-95"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
          <span className="absolute inset-0 bg-black/0 transition hover:bg-black/10" />
        </button>
        {rest.map((img, i) => {
          const photoIndex = i + 1;
          const isLastGrid = i === rest.length - 1 && extra > 0;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => openAt(isLastGrid ? 0 : photoIndex)}
              className="relative hidden aspect-square bg-stone-100 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bonnet sm:block"
              aria-label={
                isLastGrid
                  ? `View all ${photos.length} photos`
                  : `View photo ${photoIndex + 1} of ${photos.length}: ${img.alt || title}`
              }
            >
              <Image
                src={img.url}
                alt={img.alt || title}
                fill
                className="object-cover"
                sizes="25vw"
              />
              {isLastGrid ? (
                <span className="absolute inset-0 flex items-end justify-end bg-black/30 p-3 transition hover:bg-black/40">
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-md ring-1 ring-black/5">
                    +{extra} more
                  </span>
                </span>
              ) : (
                <span className="absolute inset-0 bg-black/0 transition hover:bg-black/10" />
              )}
            </button>
          );
        })}
      </div>

      {photos.length > 1 ? (
        <div className="mt-3 flex items-center gap-2 sm:hidden">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            {photos.slice(1).map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => openAt(i + 1)}
                className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bonnet"
                aria-label={`View photo ${i + 2} of ${photos.length}`}
              >
                <Image
                  src={img.url}
                  alt={img.alt || title}
                  fill
                  className="object-cover"
                  sizes="112px"
                />
              </button>
            ))}
          </div>
          {photos.length > 2 ? (
            <button
              type="button"
              onClick={() => openAt(0)}
              className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-900 shadow-sm hover:bg-stone-50"
            >
              View all
            </button>
          ) : null}
        </div>
      ) : null}

      {photos.length > 1 ? (
        <div className="mt-3 hidden sm:block">
          <button
            type="button"
            onClick={() => openAt(0)}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 shadow-sm hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bonnet"
          >
            Show all {photos.length} photos
          </button>
        </div>
      ) : null}

      {open ? (
        <PhotoLightbox
          photos={photos}
          title={title}
          index={index}
          onIndexChange={setIndex}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function PhotoLightbox({
  photos,
  title,
  index,
  onIndexChange,
  onClose,
}: {
  photos: Photo[];
  title: string;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const mounted = useIsClient();
  const current = photos[index] ?? photos[0];

  const goPrev = useCallback(() => {
    onIndexChange((index - 1 + photos.length) % photos.length);
  }, [index, onIndexChange, photos.length]);

  const goNext = useCallback(() => {
    onIndexChange((index + 1) % photos.length);
  }, [index, onIndexChange, photos.length]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Listing stays visible through a translucent scrim */}
      <button
        type="button"
        className="absolute inset-0 bg-stone-950/55 backdrop-blur-[2px]"
        aria-label="Close photo gallery and return to listing"
        onClick={onClose}
      />

      {/* Close control — always top-right */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-20 inline-flex size-11 items-center justify-center rounded-full bg-white text-stone-900 shadow-lg ring-1 ring-black/10 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-5 sm:top-5"
        aria-label="Close photo gallery"
      >
        <X className="size-5" strokeWidth={2.5} />
      </button>

      <p
        id={titleId}
        className="pointer-events-none absolute left-3 top-4 z-20 max-w-[calc(100%-5rem)] truncate rounded-full bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm sm:left-5 sm:top-6"
      >
        {title}
        <span className="ml-2 font-normal text-white/80">
          {index + 1} / {photos.length}
        </span>
      </p>

      {/* Stage: click outside image closes; image + controls stop propagation */}
      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-3 pb-28 pt-16 sm:px-6"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-5xl"
          style={{ height: "min(72vh, 720px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative h-full w-full overflow-hidden rounded-xl bg-black/20 shadow-2xl ring-1 ring-white/10">
            <Image
              key={current.id}
              src={current.url}
              alt={current.alt || `${title} photo ${index + 1}`}
              fill
              className="object-contain"
              sizes="(max-width: 1280px) 100vw, 1024px"
              priority
            />

            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-stone-900 shadow-md ring-1 ring-black/10 hover:bg-white sm:left-3 sm:size-11"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-2 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-stone-900 shadow-md ring-1 ring-black/10 hover:bg-white sm:right-3 sm:size-11"
                  aria-label="Next photo"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {photos.length > 1 ? (
        <div
          className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-stone-950/50 px-3 py-3 backdrop-blur-md sm:px-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto pb-1">
            {photos.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => onIndexChange(i)}
                className={cn(
                  "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-16 sm:w-24",
                  i === index
                    ? "ring-white"
                    : "ring-transparent opacity-70 hover:opacity-100",
                )}
                aria-label={`Go to photo ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
