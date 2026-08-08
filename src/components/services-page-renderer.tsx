import type { ReactNode } from "react";
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

function imageSrc(b: ServicesBlock): string | null {
  if (b.type === "image") {
    return (b.imageUrl || b.content || "").trim() || null;
  }
  return (b.imageUrl || "").trim() || null;
}

/**
 * Guest-facing render of Services page blocks.
 * Cards support photo + title + price + details (boat fleet layout).
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

  // Group consecutive cards into a responsive grid
  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    if (b.type === "card") {
      const cardGroup: ServicesBlock[] = [];
      while (i < blocks.length && blocks[i]!.type === "card") {
        cardGroup.push(blocks[i]!);
        i++;
      }
      nodes.push(
        <div
          key={`cards-${cardGroup[0]!.id}`}
          className="grid gap-5 sm:grid-cols-2"
        >
          {cardGroup.map((card) => (
            <ServiceCard key={card.id} block={card} />
          ))}
        </div>,
      );
      continue;
    }

    nodes.push(<Block key={b.id} block={b} basePath={basePath} />);
    i++;
  }

  return <div className={cn("space-y-8", className)}>{nodes}</div>;
}

function ServiceCard({ block }: { block: ServicesBlock }) {
  const src = imageSrc(block);
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={block.content || "Service"}
          className="h-48 w-full object-cover sm:h-52"
        />
      ) : (
        <div className="flex h-40 items-center justify-center bg-stone-100 text-sm text-stone-400 sm:h-44">
          Photo coming soon
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-stone-900">
          {block.content || "Service"}
        </h3>
        {block.price?.trim() ? (
          <p className="mt-1.5 text-sm font-semibold text-[var(--color-brand,#2563eb)]">
            {block.price}
          </p>
        ) : null}
        {block.secondary?.trim() ? (
          <p className="mt-2 flex-1 whitespace-pre-line text-sm leading-relaxed text-stone-600">
            {block.secondary}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Block({
  block: b,
  basePath,
}: {
  block: ServicesBlock;
  basePath: string;
}) {
  switch (b.type) {
    case "heading":
      return (
        <h2 className="font-display text-2xl font-medium tracking-tight text-stone-900 sm:text-3xl">
          {b.content || "Heading"}
        </h2>
      );
    case "text":
      return (
        <p className="whitespace-pre-line text-base leading-relaxed text-stone-700">
          {b.content}
        </p>
      );
    case "list": {
      const items = b.content
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return (
        <ul className="list-inside list-disc space-y-1.5 text-stone-700">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
    }
    case "image": {
      const src = imageSrc(b);
      return src ? (
        <figure className="overflow-hidden rounded-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
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
        <div className="rounded-3xl border border-dashed border-stone-200 bg-stone-50 py-16 text-center text-sm text-stone-400">
          Image not set
        </div>
      );
    }
    case "button": {
      const href = hrefFor(basePath, b.secondary || "/stays");
      const external = /^https?:\/\//i.test(href);
      return (
        <div>
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
      return <hr className="border-0 border-t border-stone-200" />;
    default:
      return null;
  }
}
