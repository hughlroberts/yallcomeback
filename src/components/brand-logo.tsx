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
 * Vertical cannon mark for the header (files 3 zip — tall narrow art).
 * viewBox is ~20×100 (already upright).
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
  // Vertical source from brand kit (not the horizontal h- variants)
  const src =
    tone === "currentcolor"
      ? "/brand/ycb-cannon-bare-currentcolor.svg"
      : `/brand/ycb-cannon-bare-${tone}.svg`;
  return (
    <Image
      src={src}
      alt=""
      width={20}
      height={100}
      className={cn("shrink-0", className)}
      priority={priority}
      unoptimized
    />
  );
}

/**
 * Header lockup: small vertical cannon + “yall come back” wordmark.
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
        "ycb-logo group inline-flex min-w-0 items-center gap-2 sm:gap-2.5",
        className,
      )}
      aria-label="yall come back, home"
    >
      <BrandCannon
        tone="bonnet"
        priority
        // Tall + thin — much smaller than before
        className="h-7 w-auto sm:h-8 md:h-9"
      />
      <span className="inline-flex min-w-0 items-baseline">
        <span className="ycb-logo__quote" aria-hidden>
          &ldquo;
        </span>
        <span className="truncate">yall come back</span>
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
