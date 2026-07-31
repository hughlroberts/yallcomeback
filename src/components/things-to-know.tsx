import Link from "next/link";
import {
  CalendarDays,
  Search,
  Shield,
} from "lucide-react";
import { AMENITY_SAFETY } from "@/lib/listing-amenities";
import {
  HELP_CANCELLATION_POLICIES_PATH,
  getLongStayPolicy,
  getShortStayPolicy,
  guestFacingBullets,
} from "@/lib/cancellation-policies";
import { petRuleLine } from "@/lib/pets";
import { formatTime12h } from "@/lib/utils";

type Props = {
  checkInTime: string;
  checkOutTime: string;
  maxGuests: number;
  houseRules?: string | null;
  petsAllowed?: boolean;
  /** Max pets/dogs when pets allowed; 0 = no fixed cap */
  maxPets?: number;
  /** Stored amenity labels or ids */
  amenities?: string[];
  /** Scroll target for booking widget dates */
  datesHref?: string;
  className?: string;
  cancellationPolicy?: string | null;
  longTermCancellationPolicy?: string | null;
  nonRefundableOption?: boolean;
};

/** @deprecated Use formatTime12h from @/lib/utils */
export function formatListingClock(raw: string): string {
  return formatTime12h(raw);
}

function safetyItemsFromAmenities(amenities: string[]): string[] {
  const lower = amenities.map((a) => a.trim().toLowerCase());
  const found: string[] = [];
  for (const opt of AMENITY_SAFETY) {
    if (
      lower.includes(opt.id) ||
      lower.includes(opt.label.toLowerCase())
    ) {
      found.push(opt.label);
    }
  }
  const extras: [RegExp, string][] = [
    [/security\s*camera|exterior\s*camera|cctv/i, "Exterior security cameras on property"],
    [/smoke/i, "Smoke alarm"],
    [/carbon|co\s*alarm|monoxide/i, "Carbon monoxide alarm"],
  ];
  for (const [re, label] of extras) {
    if (found.includes(label)) continue;
    if (amenities.some((a) => re.test(a))) found.push(label);
  }
  return found.slice(0, 5);
}

function houseRuleHighlights(opts: {
  checkInTime: string;
  checkOutTime: string;
  maxGuests: number;
  petsAllowed?: boolean;
  maxPets?: number;
  houseRules?: string | null;
}): string[] {
  const lines: string[] = [
    `Check-in after ${formatTime12h(opts.checkInTime)}`,
    `Checkout before ${formatTime12h(opts.checkOutTime)}`,
    `${opts.maxGuests} guest${opts.maxGuests === 1 ? "" : "s"} maximum`,
  ];
  if (opts.petsAllowed === false) {
    lines.push("No pets");
  } else if (opts.petsAllowed === true) {
    const petLine = petRuleLine({
      petsAllowed: true,
      petFee: 0,
      maxPets: opts.maxPets ?? 0,
    });
    if (petLine) lines.push(petLine);
  }
  if (opts.houseRules?.trim()) {
    const extra = opts.houseRules
      .split(/\n+/)
      .map((s) => s.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .filter((s) => s.length < 80)
      .slice(0, 2);
    for (const e of extra) {
      if (!lines.some((l) => l.toLowerCase() === e.toLowerCase())) {
        lines.push(e);
      }
    }
  }
  return lines.slice(0, 5);
}

/**
 * Airbnb-style three-column “Things to know” block.
 */
export function ThingsToKnow({
  checkInTime,
  checkOutTime,
  maxGuests,
  houseRules,
  petsAllowed,
  maxPets,
  amenities = [],
  datesHref = "#reserve",
  className = "",
  cancellationPolicy,
  longTermCancellationPolicy,
  nonRefundableOption,
}: Props) {
  const rules = houseRuleHighlights({
    checkInTime,
    checkOutTime,
    maxGuests,
    petsAllowed,
    maxPets,
    houseRules,
  });
  const safety = safetyItemsFromAmenities(amenities);
  if (safety.length === 0) {
    safety.push(
      "Review house rules before you book",
      "Report safety concerns to your host",
    );
  }

  const shortPolicy = getShortStayPolicy(cancellationPolicy);
  const longPolicy = getLongStayPolicy(longTermCancellationPolicy);
  const cancelBullets = guestFacingBullets(shortPolicy, 3);

  return (
    <section
      className={className}
      aria-labelledby="things-to-know-heading"
    >
      <h2
        id="things-to-know-heading"
        className="text-2xl font-semibold tracking-tight text-stone-900"
      >
        Things to know
      </h2>

      <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12">
        {/* Cancellation */}
        <div>
          <div className="flex items-center gap-2.5">
            <CalendarDays
              className="size-5 text-stone-700"
              strokeWidth={1.75}
              aria-hidden
            />
            <h3 className="text-base font-semibold text-stone-900">
              Cancellation policy
            </h3>
          </div>
          <p className="mt-3 text-[15px] font-medium text-stone-800">
            {shortPolicy.name}
            {nonRefundableOption ? " · Non-refundable rate option" : ""}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-stone-600">
            {shortPolicy.summary}
          </p>
          <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-stone-600">
            {cancelBullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-stone-500">
            Monthly stays (28+ nights): {longPolicy.name}.
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            <Link
              href={HELP_CANCELLATION_POLICIES_PATH}
              className="text-[15px] font-semibold text-bonnet underline-offset-2 hover:underline"
            >
              Learn more
            </Link>
            <Link
              href={datesHref}
              className="text-[15px] font-semibold text-bonnet underline-offset-2 hover:underline"
            >
              Add dates for this stay
            </Link>
          </div>
        </div>

        {/* House rules */}
        <div id="house-rules">
          <div className="flex items-center gap-2.5">
            <Search
              className="size-5 text-stone-700"
              strokeWidth={1.75}
              aria-hidden
            />
            <h3 className="text-base font-semibold text-stone-900">
              House rules
            </h3>
          </div>
          <ul className="mt-3 space-y-1.5 text-[15px] leading-relaxed text-stone-600">
            {rules.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {houseRules?.trim() ? (
            <details className="mt-3 group">
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-bonnet underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
                Learn more
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
                {houseRules}
              </p>
            </details>
          ) : (
            <p className="mt-3 text-[15px] text-stone-500">
              Full house rules are confirmed with your host after booking.
            </p>
          )}
        </div>

        {/* Safety */}
        <div>
          <div className="flex items-center gap-2.5">
            <Shield
              className="size-5 text-stone-700"
              strokeWidth={1.75}
              aria-hidden
            />
            <h3 className="text-base font-semibold text-stone-900">
              Safety &amp; property
            </h3>
          </div>
          <ul className="mt-3 space-y-1.5 text-[15px] leading-relaxed text-stone-600">
            {safety.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <details className="mt-3">
            <summary className="cursor-pointer list-none text-[15px] font-semibold text-bonnet underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
              Learn more
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              Safety features listed here come from the host&apos;s amenity
              checklist. Always verify smoke and CO alarms on arrival, and
              follow posted emergency instructions at the property.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
