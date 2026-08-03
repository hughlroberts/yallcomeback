import Link from "next/link";
import type { ServicesBlock } from "@/lib/services-blocks";
import { cn } from "@/lib/utils";

type Props = {
  blocks: ServicesBlock[];
  /** Resolve relative button hrefs (e.g. /about → /h/slug/about) */
  basePath?: string;
  className?: string;
};

function hrefFor(basePath: string, href: string) {
  const t = href.trim();
  if (!t) return basePath || "/";
  if (/^https?:\/\//i.test(t) || t.startsWith("mailto:") || t.startsWith("tel:")) {
    return t;
  }
  if (t.startsWith("#")) return t;
  if (t.startsWith("/")) return `${basePath}${t}` || t;
  return t;
}

/**
 * Guest-facing render of Services page blocks.
 */
export function ServicesPageRenderer({
  blocks,
  basePath = "",
  className,
}: Props) {
  if (blocks.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center text-stone-600",
          className,
        )}
      >
        Details coming soon.
      </div>
    );
  }

  return (
    <div className={cn("space-y-8", className)}>
      {blocks.map((b) => {
        switch (b.type) {
          case "heading":
            return (
              <h2
                key={b.id}
                className="font-display text-2xl font-medium tracking-tight text-stone-900 sm:text-3xl"
              >
                {b.content || "Heading"}
              </h2>
            );
          case "text":
            return (
              <p
                key={b.id}
                className="whitespace-pre-line text-base leading-relaxed text-stone-700"
              >
                {b.content}
              </p>
            );
          case "card":
            return (
              <div
                key={b.id}
                className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-stone-900">
                  {b.content || "Service"}
                </h3>
                {b.secondary ? (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-600">
                    {b.secondary}
                  </p>
                ) : null}
              </div>
            );
          case "list": {
            const items = b.content
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            return (
              <ul
                key={b.id}
                className="list-inside list-disc space-y-1.5 text-stone-700"
              >
                {items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            );
          }
          case "image":
            return b.content ? (
              <figure key={b.id} className="overflow-hidden rounded-3xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.content}
                  alt={b.secondary || ""}
                  className="max-h-[28rem] w-full object-cover"
                />
                {b.secondary ? (
                  <figcaption className="mt-2 text-center text-xs text-stone-500">
                    {b.secondary}
                  </figcaption>
                ) : null}
              </figure>
            ) : (
              <div
                key={b.id}
                className="rounded-3xl border border-dashed border-stone-200 bg-stone-50 py-16 text-center text-sm text-stone-400"
              >
                Image URL not set
              </div>
            );
          case "button": {
            const href = hrefFor(basePath, b.secondary || "/stays");
            const external = /^https?:\/\//i.test(href);
            return (
              <div key={b.id}>
                <Link
                  href={href}
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="inline-flex rounded-full bg-[var(--color-brand,#2563eb)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover,#1d4ed8)]"
                >
                  {b.content || "Learn more"}
                </Link>
              </div>
            );
          }
          case "divider":
            return (
              <hr key={b.id} className="border-0 border-t border-stone-200" />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
