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
 * Header lockup: YCB circular seal + Yall Come Back wordmark.
 * shrink-0 so flex never squishes/truncates the wordmark; overflow-visible for Fraunces glyphs.
 */
export function BrandLogo({
  className,
  href = "/",
  label = "Yall Come Back, home",
}: {
  className?: string;
  href?: string;
  /** Accessible name. Listing setup uses "Exit setup" so it is not read as a second Back. */
  label?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "ycb-logo group inline-flex shrink-0 items-center gap-2 overflow-visible sm:gap-3",
        className,
      )}
      aria-label={label}
      title={label === "Yall Come Back, home" ? undefined : label}
    >
      <BrandMark
        size={72}
        priority
        className="h-9 w-9 sm:h-12 sm:w-12 md:h-[3.25rem] md:w-[3.25rem]"
      />
      <span className="ycb-logo__word hidden shrink-0 items-baseline overflow-visible sm:inline-flex">
        <span className="ycb-logo__text">Yall Come Back</span>
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
 * Phrase seal (Yall Come Back + cannon in the mark) — footer / large brand moments.
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
