import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center bg-buttermilk px-4 py-20 sm:px-6">
      <div className="w-full max-w-lg rounded-[var(--radius-card)] border border-hairline bg-porcelain px-6 py-10 text-center shadow-sm sm:px-10">
        <BrandMark size={64} className="mx-auto" />
        <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-ink-muted">
          404
        </p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
          This porch light&apos;s off
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-muted">
          We couldn&apos;t find that page. It may have moved, or the listing may
          no longer be on the marketplace. Y&apos;all come back, and we&apos;ll
          help you find a place to stay.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/marketplace"
            className="inline-flex items-center justify-center rounded-[var(--radius-control)] bg-bonnet px-5 py-2.5 text-sm font-semibold text-white hover:bg-bonnet-hover active:bg-bonnet-active"
          >
            Browse stays
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-[var(--radius-control)] border border-hairline bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-petal"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
