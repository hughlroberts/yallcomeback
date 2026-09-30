"use client";

import { useEffect, useId, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { setVisitIntent } from "@/app/actions/intent";
import { BrandMark } from "@/components/brand-logo";

/**
 * First visit to the platform home: Find a Place vs Host a Place.
 * Skip/close writes `browse` so this does not return for ~1 year.
 */
export function FirstVisitIntentGate() {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const browseFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const node = dialogRef.current;
    node?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        browseFormRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-[400] flex flex-col overflow-y-auto bg-buttermilk pt-[env(safe-area-inset-top,0px)] outline-none"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex items-start justify-between gap-3">
          <div className="ycb-logo inline-flex items-center gap-2.5">
            <BrandMark
              size={56}
              priority
              className="h-10 w-10 sm:h-12 sm:w-12"
            />
            <span className="ycb-logo__text">Yall Come Back</span>
          </div>
          <form ref={browseFormRef} action={setVisitIntent}>
            <input type="hidden" name="intent" value="browse" />
            <button
              type="submit"
              className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-petal hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bonnet"
              aria-label="Just browsing"
            >
              <X className="size-5" aria-hidden />
            </button>
          </form>
        </div>

        <div className="mx-auto mt-8 max-w-2xl text-center sm:mt-12">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-bonnet">
            Welcome
          </p>
          <p
            id={titleId}
            className="mt-3 font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl md:text-5xl"
            style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1' }}
          >
            Finding a stay, or hosting one?
          </p>
          <p className="mt-3 text-base leading-relaxed text-ink-muted sm:text-lg">
            Pick once. The menu still has both if you change your mind.
          </p>
        </div>

        <div className="mt-8 grid flex-1 gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-6">
          <IntentCard
            intent="find"
            image="/seed/hero/home.jpg"
            imageAlt="Lakefront stay"
            eyebrow="Guests"
            title="Find a Place"
            body="Book the host who already made it great."
          />
          <IntentCard
            intent="host"
            image="/seed/hero/for-hosts.jpg"
            imageAlt="A host at their place"
            eyebrow="Hosts"
            title="Host a Place"
            body="Keep the guests who already know you."
          />
        </div>

        <form action={setVisitIntent} className="mt-6 pb-[env(safe-area-inset-bottom,0px)] text-center sm:mt-8">
          <input type="hidden" name="intent" value="browse" />
          <button
            type="submit"
            className="text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bonnet"
          >
            Just browsing
          </button>
        </form>
      </div>
    </div>
  );
}

function IntentCard({
  intent,
  image,
  imageAlt,
  eyebrow,
  title,
  body,
}: {
  intent: "find" | "host";
  image: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <form action={setVisitIntent} className="h-full">
      <input type="hidden" name="intent" value={intent} />
      <button
        type="submit"
        className="group relative flex h-full min-h-[14rem] w-full flex-col overflow-hidden rounded-3xl text-left shadow-[0_8px_24px_rgba(42,53,102,0.12),0_2px_6px_rgba(42,53,102,0.08)] ring-1 ring-hairline transition hover:ring-2 hover:ring-honey focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bonnet sm:min-h-[22rem]"
      >
        <Image
          src={image}
          alt={imageAlt}
          fill
          priority
          className="object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          sizes="(max-width: 640px) 100vw, 50vw"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/45 to-stone-950/15"
          aria-hidden
        />
        <div className="relative mt-auto p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-honey/90">
            {eyebrow}
          </p>
          <span className="mt-1 block font-display text-2xl font-medium text-white sm:text-3xl">
            {title}
          </span>
          <p className="mt-2 text-sm leading-relaxed text-stone-200 sm:text-base">
            {body}
          </p>
        </div>
      </button>
    </form>
  );
}
