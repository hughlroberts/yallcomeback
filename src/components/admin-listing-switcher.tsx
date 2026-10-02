import Image from "next/image";
import Link from "next/link";
import { shortStayTitle } from "@/lib/stay-title";
import {
  visibilityFromFlags,
  visibilityLabel,
} from "@/lib/listing-visibility";
import { cn } from "@/lib/utils";

export type SwitcherListing = {
  id: string;
  title: string;
  published: boolean;
  listOnMarketplace: boolean;
  coverUrl: string | null;
};

export function AdminListingSwitcher({
  listings,
  activeId,
  hrefFor = (id) => `/admin/calendar?property=${id}`,
  stackFrom = "sm",
}: {
  listings: SwitcherListing[];
  activeId: string;
  hrefFor?: (id: string) => string;
  /** Vertical list from this breakpoint; tiles underneath until then. */
  stackFrom?: "sm" | "lg";
}) {
  const atLg = stackFrom === "lg";

  return (
    <aside className={cn("w-full shrink-0", atLg ? "lg:w-60" : "sm:w-60")}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        Your stays
      </p>
      <nav
        className={cn(
          "flex gap-2 overflow-x-auto pb-1",
          atLg
            ? "lg:flex-col lg:gap-1 lg:overflow-visible"
            : "sm:flex-col sm:gap-1 sm:overflow-visible",
        )}
      >
        {listings.map((p) => {
          const active = p.id === activeId;
          const vis = visibilityFromFlags(p.published, p.listOnMarketplace);
          const on = vis !== "off";
          return (
            <Link
              key={p.id}
              href={hrefFor(p.id)}
              className={cn(
                "flex w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-xl border px-1 py-1 text-center",
                atLg
                  ? "lg:w-auto lg:min-w-0 lg:flex-row lg:items-center lg:gap-2 lg:px-1.5 lg:py-1 lg:text-left"
                  : "sm:w-auto sm:min-w-0 sm:flex-row sm:items-center sm:gap-2 sm:px-1.5 sm:py-1 sm:text-left",
                active
                  ? "border-bonnet bg-petal/70 ring-1 ring-bonnet/30"
                  : "border-stone-200 bg-white hover:bg-stone-50",
              )}
            >
              <span
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden rounded-lg bg-stone-100",
                  atLg ? "lg:size-8" : "sm:size-8",
                )}
              >
                {p.coverUrl ? (
                  <Image
                    src={p.coverUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes={atLg ? "(min-width: 1024px) 32px, 56px" : "(min-width: 640px) 32px, 56px"}
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  "min-w-0 w-full",
                  atLg ? "lg:flex-1" : "sm:flex-1",
                )}
              >
                <span
                  className={cn(
                    "block w-full text-[11px] font-medium leading-tight text-stone-900",
                    atLg
                      ? "line-clamp-2 lg:hidden"
                      : "line-clamp-2 sm:hidden",
                  )}
                >
                  {shortStayTitle(p.title)}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-sm font-medium text-stone-900",
                    atLg ? "lg:block" : "sm:block",
                  )}
                >
                  {p.title}
                </span>
                <span
                  className={cn(
                    "mt-0.5 hidden items-start gap-1 text-[11px] leading-tight",
                    atLg ? "lg:flex" : "sm:flex",
                    on ? "text-emerald-800" : "text-stone-500",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1 size-1.5 shrink-0 rounded-full",
                      on ? "bg-emerald-500" : "bg-stone-400",
                    )}
                    aria-hidden
                  />
                  <span>{visibilityLabel(vis)}</span>
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
