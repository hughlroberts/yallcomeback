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

/** Horizontal cannon mark (new top-logo art). */
export function BrandCannon({
  className,
  /** bonnet on light header; honey/cream on dark */
  tone = "bonnet",
  priority = false,
}: {
  className?: string;
  tone?: "bonnet" | "honey" | "dusk" | "cream" | "currentcolor";
  priority?: boolean;
}) {
  const src = `/brand/ycb-cannon-h-${tone}.svg`;
  return (
    <Image
      src={src}
      alt=""
      width={100}
      height={21}
      className={cn("shrink-0", className)}
      priority={priority}
      unoptimized
    />
  );
}

/**
 * Header lockup: cannon mark + “yall come back” wordmark.
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
        "ycb-logo group inline-flex min-w-0 items-center gap-2.5 sm:gap-3",
        className,
      )}
      aria-label="yall come back, home"
    >
      <BrandCannon
        tone="bonnet"
        priority
        className="h-8 w-auto sm:h-9 md:h-10"
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
 * Phrase seal (“yall come back” in the mark) — footer / large brand moments.
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
