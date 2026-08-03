"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type Props = {
  name?: string;
  defaultValue?: string;
  suggestions: string[];
  placeholder?: string;
  className?: string;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

/** Rank suggestions: prefix matches first, then substring. */
function filterSuggestions(query: string, all: string[], limit = 10): string[] {
  const q = normalize(query);
  // Only suggest after the guest starts typing - avoids covering the page on focus
  if (!q) return [];

  const scored: { label: string; score: number }[] = [];
  for (const label of all) {
    const n = normalize(label);
    if (!n.includes(q)) continue;
    let score = 0;
    if (n.startsWith(q)) score += 100;
    else if (n.split(/[,\s]+/).some((w) => w.startsWith(q))) score += 50;
    else score += 10;
    score += Math.max(0, 20 - label.length / 10);
    scored.push({ label, score });
  }
  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return scored.slice(0, limit).map((s) => s.label);
}

export function WhereAutocomplete({
  name = "where",
  defaultValue = "",
  suggestions,
  placeholder = "Anywhere",
  className,
}: Props) {
  // useId can include colons - strip for getElementById safety
  const listId = `where-suggest-${useId().replace(/:/g, "")}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const mounted = useIsClient();

  const filtered = useMemo(
    () => filterSuggestions(value, suggestions),
    [value, suggestions],
  );

  const showList = open && filtered.length > 0 && suggestions.length > 0;

  function updateMenuPosition() {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - Math.min(width, window.innerWidth - 16) - 8,
    );
    setMenuBox({
      top: rect.bottom + 8,
      left,
      width: Math.min(width, window.innerWidth - 16),
    });
  }

  useLayoutEffect(() => {
    if (!showList) return;
    updateMenuPosition();
    function onScrollOrResize() {
      // Close on scroll so the list never sits over the sticky site header
      setOpen(false);
      setActiveIndex(-1);
    }
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [showList, value, filtered.length]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      const menu = document.getElementById(listId);
      if (menu?.contains(t)) return;
      setOpen(false);
      setActiveIndex(-1);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [listId]);

  function pick(label: string) {
    setValue(label);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || filtered.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(filtered[activeIndex]!);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  // z-40 stays under site header (z-200) so nav/profile stay clickable
  const menu =
    mounted && showList && menuBox
      ? createPortal(
          <ul
            id={listId}
            role="listbox"
            style={{
              position: "fixed",
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
            }}
            className="z-40 max-h-72 overflow-auto rounded-2xl border border-stone-200 bg-white py-2 shadow-xl shadow-stone-900/10"
          >
            {filtered.map((label, i) => {
              const active = i === activeIndex;
              return (
                <li
                  key={label}
                  role="option"
                  aria-selected={active}
                  id={`${listId}-opt-${i}`}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(label)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition",
                      active ? "bg-stone-100" : "hover:bg-stone-50",
                    )}
                  >
                    <MapPin
                      className="mt-0.5 size-4 shrink-0 text-stone-500"
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0 flex-1 font-medium text-stone-900">
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <input
        ref={inputRef}
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (normalize(value)) setOpen(true);
        }}
        onBlur={() => {
          // Delay so option click can fire first
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
        }
        className={cn(
          "w-full min-w-0 border-0 bg-transparent p-0 text-sm text-stone-900 outline-none placeholder:text-stone-400",
          className,
        )}
      />
      {menu}
    </div>
  );
}
