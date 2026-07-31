import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Official seal mark from brand kit. */
export function BrandMark({
  className,
  size = 32,
  mono = false,
}: {
  className?: string;
  size?: number;
  /** Outline seal for dark / bonnet backgrounds */
  mono?: boolean;
}) {
  const src = mono ? "/brand/ycb-seal-mono.svg" : "/brand/ycb-seal.svg";
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      priority
      unoptimized
    />
  );
}

/**
 * Header lockup: seal + wordmark “yall come back” in honey quotes.
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
        "ycb-logo group inline-flex min-w-0 items-center gap-2.5",
        className,
      )}
      aria-label="yall come back, home"
    >
      <BrandMark size={36} className="h-9 w-9" />
      <span className="hidden min-w-0 items-baseline sm:inline-flex">
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

/** Full-color seal for trust spots (checkout, print, about). */
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
