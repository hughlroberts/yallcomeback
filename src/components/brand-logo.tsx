import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Compact YCB monogram seal — for header / tight chrome. */
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
 * Header mark: compact YCB seal only (phrase lives in the footer).
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
        "group inline-flex shrink-0 items-center",
        className,
      )}
      aria-label="yall come back, home"
    >
      <BrandMark
        size={72}
        priority
        className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14"
      />
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
 * Prefer mono on bonnet backgrounds so gold/cream reads correctly.
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
