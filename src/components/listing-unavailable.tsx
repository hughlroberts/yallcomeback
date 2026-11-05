import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";
import { LISTING_UNAVAILABLE_TITLE } from "@/lib/brand-visibility";
import { PRIMARY_CTA_FOCUS_CLASS } from "@/lib/booking-cta-focus";

/** Clean page for a listing whose brand is hidden (T46). Status 200. */
export function ListingUnavailable() {
  return (
    <div
      data-testid="listing-unavailable"
      className="flex flex-1 items-center justify-center bg-buttermilk px-4 py-20 sm:px-6"
    >
      <div className="w-full max-w-lg rounded-[var(--radius-card)] border border-hairline bg-porcelain px-6 py-10 text-center shadow-sm sm:px-10">
        <BrandMark size={64} className="mx-auto" />
        <h1 className="mt-6 font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
          {LISTING_UNAVAILABLE_TITLE}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-muted">
          The host can&apos;t take new stays here right now. If you already
          booked, your booking is safe. Open Your bookings to see it.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/marketplace"
            className={`inline-flex items-center justify-center rounded-[var(--radius-control)] bg-bonnet px-5 py-2.5 text-sm font-semibold text-white hover:bg-bonnet-hover active:bg-bonnet-active ${PRIMARY_CTA_FOCUS_CLASS}`}
          >
            Browse stays
          </Link>
          <Link
            href="/account/bookings"
            className="inline-flex items-center justify-center rounded-[var(--radius-control)] border border-hairline bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-petal"
          >
            Your bookings
          </Link>
        </div>
      </div>
    </div>
  );
}
