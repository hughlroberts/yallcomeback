import Image from "next/image";
import Link from "next/link";
import { visibilityFromFlags, visibilityLabel } from "@/lib/listing-visibility";
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
}: {
  listings: SwitcherListing[];
  activeId: string;
}) {
  return (
    <aside className="w-full shrink-0 sm:w-56">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        Your stays
      </p>
      <nav className="flex gap-2 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible">
        {listings.map((p) => {
          const vis = visibilityFromFlags(p.published, p.listOnMarketplace);
          const active = p.id === activeId;
          return (
            <Link
              key={p.id}
              href={`/admin/properties/${p.id}?tab=calendar`}
              className={cn(
                "flex min-w-[11rem] items-center gap-2.5 rounded-xl border px-2 py-2 text-left sm:min-w-0",
                active
                  ? "border-bonnet bg-petal/70 ring-1 ring-bonnet/30"
                  : "border-stone-200 bg-white hover:bg-stone-50",
              )}
            >
              <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                {p.coverUrl ? (
                  <Image
                    src={p.coverUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-stone-900">
                  {p.title}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-[11px]",
                    vis === "off" ? "text-amber-800" : "text-stone-500",
                  )}
                >
                  {visibilityLabel(vis)}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
