"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type BrandPageNavItem = { id: string; label: string };

/** Sit just under the sticky site header; never cover Admin nav. */
const STICKY_TOP =
  "top-[calc(5.5rem+env(safe-area-inset-top,0px)+0.5rem)]";

export function BrandPageNav({ items }: { items: BrandPageNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const els = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        const id = visible[0]?.target.id;
        if (id) setActive(id);
      },
      {
        rootMargin: "-28% 0px -58% 0px",
        threshold: [0, 0.2, 0.5, 1],
      },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  function go(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
  }

  return (
    <div
      className={cn(
        "sticky z-20 self-start",
        STICKY_TOP,
        "-mx-4 mb-4 border-b border-stone-200/80 bg-[var(--background)]/95 px-4 py-2 backdrop-blur",
        "lg:mx-0 lg:mb-0 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none",
      )}
    >
      <p className="mb-2 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400 lg:block">
        On this page
      </p>
      <nav
        aria-label="On this page"
        className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible"
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(event) => go(event, item.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap lg:rounded-lg lg:px-3 lg:py-1.5 lg:text-sm lg:leading-snug lg:whitespace-normal",
              active === item.id
                ? "bg-bonnet text-white lg:bg-petal lg:font-medium lg:text-bonnet"
                : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50 lg:bg-transparent lg:text-stone-600 lg:ring-0 lg:hover:bg-stone-50 lg:hover:text-stone-900",
            )}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
