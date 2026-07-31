import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Compact YCB monogram seal — header mark + compact chrome. */
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
 * Header lockup: YCB seal (compact) + “yall come back” wordmark.
 * Always show both so the brand is readable at a glance.
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
        "ycb-logo group inline-flex min-w-0 items-center gap-2 sm:gap-3",
        className,
      )}
      aria-label="yall come back, home"
    >
      <BrandMark
        size={72}
        priority
        className="h-10 w-10 sm:h-12 sm:w-12 md:h-[3.25rem] md:w-[3.25rem]"
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
