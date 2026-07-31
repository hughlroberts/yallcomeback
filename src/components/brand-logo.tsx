import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Compact YCB monogram seal — checkout, magnets, compact chrome. */
export function BrandMark({
  className,
  size = 48,
  mono = false,
  priority = false,
}: {
  className?: string;
  size?: number;
  /** Outline seal for dark / bonnet backgrounds */
  mono?: boolean;
  priority?: boolean;
}) {
  const src = mono ? "/brand/ycb-seal-mono.svg" : "/brand/ycb-seal.svg";
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      priority={priority}
      unoptimized
    />
  );
}

/**
 * Vertical cannon for the header.
 * Height-driven + w-auto so the full silhouette shows (no forced narrow box).
 * Padded SVG keeps muzzle/wheels inside the paint box.
 */
export function BrandCannon({
  className,
  tone = "bonnet",
  priority = false,
}: {
  className?: string;
  tone?: "bonnet" | "honey" | "dusk" | "cream" | "currentcolor";
  priority?: boolean;
}) {
  const src = `/brand/ycb-cannon-v-${tone}.svg`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- w-auto + overflow-visible; next/image wraps and can clip tall SVGs
    <img
      src={src}
      alt=""
      width={24}
      height={104}
      className={cn(
        "ycb-logo__cannon block h-full w-auto max-w-none shrink-0 object-contain object-center",
        className,
      )}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
    />
  );
}

/**
 * Header lockup: YCB circular seal + “yall come back” wordmark.
 * shrink-0 so flex never squishes/truncates the wordmark; overflow-visible for Fraunces glyphs.
 */
export function BrandLogo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "ycb-logo group inline-flex shrink-0 items-center gap-2.5 overflow-visible sm:gap-3",
        className,
      )}
      aria-label="yall come back, home"
    >
      <BrandMark
        size={72}
        priority
        className="h-10 w-10 sm:h-12 sm:w-12 md:h-[3.25rem] md:w-[3.25rem]"
      />
      <span className="ycb-logo__word inline-flex shrink-0 items-baseline overflow-visible">
        <span className="ycb-logo__quote" aria-hidden>
          &ldquo;
        </span>
        <span className="ycb-logo__text">yall come back</span>
        <span className="ycb-logo__quote" aria-hidden>
          &rdquo;
        </span>
      </span>
    </Link>
  );
}

/** Full-color compact seal (checkout, about, magnets). */
export function BrandSeal({
  className,
  size = 120,
  mono = false,
}: {
  className?: string;
  size?: number;
  mono?: boolean;
}) {
  const src = mono ? "/brand/ycb-seal-mono.svg" : "/brand/ycb-seal.svg";
  return (
    <Image
      src={src}
      alt="Yall Come Back"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      unoptimized
    />
  );
}

/**
 * Phrase seal (“yall come back” + cannon in the mark) — footer / large brand moments.
 */
export function BrandPhraseSeal({
  className,
  size = 200,
  mono = false,
}: {
  className?: string;
  size?: number;
  mono?: boolean;
}) {
  const src = mono
    ? "/brand/ycb-seal-phrase-mono.svg"
    : "/brand/ycb-seal-phrase.svg";
  return (
    <Image
      src={src}
      alt="Yall Come Back"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      unoptimized
    />
  );
}
