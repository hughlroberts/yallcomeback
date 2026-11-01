/**
 * When a guest may cancel online, per the listing's cancellation policy.
 *
 * The online deadline is the last refund tier the policy offers (for example
 * Moderate: 5 days before check-in; Firm: 7 days, the end of its 50% window).
 * After it, the guest sees "Contact host to cancel" and the host decides.
 * Refunds are never sent automatically: the host or Yall Come Back processes
 * any refund the policy allows.
 *
 * Check-in is the listing's check-in time on the check-in date, in the
 * marketplace home zone (America/Chicago).
 */
import {
  LONG_STAY_NIGHTS_MIN,
  getLongStayPolicy,
  getShortStayPolicy,
} from "@/lib/cancellation-policies";
import { HOST_TIME_ZONE } from "@/lib/host-today";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * 24-hour free cancellation (Help → Cancellation policies): every short-stay
 * policy gives a full refund for 24 hours after booking when the booking was
 * made at least 7 days before check-in. For stricter policies this can move
 * the online deadline later; Flexible and Moderate already allow more.
 */
export const FREE_CANCEL_HOURS = 24;
export const FREE_CANCEL_MIN_LEAD_DAYS = 7;
export const FREE_CANCEL_24H_TEXT =
  "24-hour free cancellation: if you book at least 7 days before check-in, you can cancel for a full refund within 24 hours of booking.";

type Tiers = {
  /** Full refund until this many days before check-in (null = none). */
  fullDays: number | null;
  /** Partial (50%) refund until this many days before check-in. */
  partialDays: number | null;
};

const SHORT_TIERS: Record<string, Tiers> = {
  FLEXIBLE: { fullDays: 1, partialDays: null },
  MODERATE: { fullDays: 5, partialDays: null },
  LIMITED: { fullDays: 14, partialDays: 7 },
  FIRM: { fullDays: 30, partialDays: 7 },
  STRICT: { fullDays: null, partialDays: 7 },
  SUPER_FIRM_30: { fullDays: null, partialDays: 30 },
  SUPER_FIRM_60: { fullDays: null, partialDays: 60 },
};

export type RefundTier = "full" | "partial" | "none";

export type GuestCancelWindow = {
  policyName: string;
  /** Check-in moment (listing check-in time, host zone). */
  checkInAt: Date;
  /** Last moment the guest can cancel online. */
  deadline: Date;
  canCancelOnline: boolean;
  /** Refund tier that applies if they cancel now (per policy text). */
  refundTier: RefundTier;
  /** Guest-facing one-liner about the online cancel deadline. */
  ruleText: string;
  /**
   * End of the 24-hour free-cancel window when this booking qualifies
   * (short stay booked 7+ days ahead), else null.
   */
  freeCancelUntil: Date | null;
  /** Guest-facing 24-hour free-cancel line (short stays), else null. */
  freeCancelText: string | null;
  /** True while `now` is inside the 24-hour free-cancel window. */
  inFreeCancelWindow: boolean;
};

/** UTC instant for a wall-clock time in `timeZone`. */
export function zonedTime(
  ymd: string,
  hhmm: string,
  timeZone: string = HOST_TIME_ZONE,
): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  const h = m ? Number(m[1]) : 16;
  const mi = m ? Number(m[2]) : 0;
  const guess = Date.UTC(y!, (mo ?? 1) - 1, d ?? 1, h, mi);
  // Offset of the zone at that instant (two passes handle DST edges).
  const offsetAt = (t: number) => {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(t));
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value);
    return (
      Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - t
    );
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return new Date(t);
}

/** YYYY-MM-DD of a stored booking date (stored as local midnight). */
export function bookingYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysText(days: number): string {
  if (days === 1) return "24 hours";
  return `${days} days`;
}

export function guestCancelWindow(opts: {
  nights: number;
  checkIn: Date;
  createdAt: Date;
  checkInTime?: string | null;
  cancellationPolicy?: string | null;
  longTermCancellationPolicy?: string | null;
  now?: Date;
}): GuestCancelWindow {
  const now = (opts.now ?? new Date()).getTime();
  const checkInAt = zonedTime(
    bookingYmd(opts.checkIn),
    opts.checkInTime || "16:00",
  );
  const ci = checkInAt.getTime();
  const created = opts.createdAt.getTime();

  if (opts.nights >= LONG_STAY_NIGHTS_MIN) {
    const policy = getLongStayPolicy(opts.longTermCancellationPolicy);
    if (policy.id === "STRICT") {
      const deadline = Math.min(created + 48 * HOUR, ci - 28 * DAY);
      const ok = now < deadline;
      return {
        policyName: policy.name,
        checkInAt,
        deadline: new Date(deadline),
        canCancelOnline: ok,
        refundTier: ok ? "full" : "none",
        ruleText:
          "You can cancel online within 48 hours of booking, if check-in is at least 28 days away. After that, contact the host to cancel.",
        freeCancelUntil: null,
        freeCancelText: null,
        inFreeCancelWindow: false,
      };
    }
    const deadline = ci - 30 * DAY;
    const ok = now < deadline;
    return {
      policyName: policy.name,
      checkInAt,
      deadline: new Date(deadline),
      canCancelOnline: ok,
      refundTier: ok ? "full" : "none",
      ruleText:
        "You can cancel online until 30 days before check-in. After that, contact the host to cancel.",
      freeCancelUntil: null,
      freeCancelText: null,
      inFreeCancelWindow: false,
    };
  }

  const policy = getShortStayPolicy(opts.cancellationPolicy);
  const tiers = SHORT_TIERS[policy.id] ?? SHORT_TIERS.MODERATE!;
  const lastDays = (tiers.partialDays ?? tiers.fullDays)!;
  let deadline = ci - lastDays * DAY;
  const graceEnd =
    created <= ci - FREE_CANCEL_MIN_LEAD_DAYS * DAY
      ? created + FREE_CANCEL_HOURS * HOUR
      : null;
  if (graceEnd != null) deadline = Math.max(deadline, graceEnd);

  let refundTier: RefundTier = "none";
  if (graceEnd != null && now < graceEnd) refundTier = "full";
  else if (tiers.fullDays != null && now < ci - tiers.fullDays * DAY)
    refundTier = "full";
  else if (tiers.partialDays != null && now < ci - tiers.partialDays * DAY)
    refundTier = "partial";

  const ok = now < deadline;
  return {
    policyName: policy.name,
    checkInAt,
    deadline: new Date(deadline),
    canCancelOnline: ok,
    refundTier: ok ? refundTier : "none",
    ruleText: shortRuleText(policy.id),
    freeCancelUntil: graceEnd != null ? new Date(graceEnd) : null,
    freeCancelText: FREE_CANCEL_24H_TEXT,
    inFreeCancelWindow: graceEnd != null && now < graceEnd,
  };
}

/** Guest-facing online-cancel rule for a short-stay policy id. */
export function shortRuleText(policyId: string): string {
  const tiers = SHORT_TIERS[policyId] ?? SHORT_TIERS.MODERATE!;
  const lastDays = (tiers.partialDays ?? tiers.fullDays)!;
  return `You can cancel online until ${daysText(lastDays)} before check-in. After that, contact the host to cancel.`;
}

/** Guest-facing online-cancel rule for a long-stay policy id. */
export function longRuleText(policyId: string): string {
  return policyId === "STRICT"
    ? "You can cancel online within 48 hours of booking, if check-in is at least 28 days away. After that, contact the host to cancel."
    : "You can cancel online until 30 days before check-in. After that, contact the host to cancel.";
}

/** Same for every policy: refunds are processed by a person, not automatically. */
export const REFUND_PROCESS_TEXT =
  "Refunds are not automatic. If you paid a deposit, the host (or Yall Come Back for card deposits) sends any refund this policy allows.";

/** Lines to show next to a policy's bullets on listing and booking pages. */
export function onlineCancelLines(
  kind: "short" | "long",
  policyId: string,
): string[] {
  if (kind === "long") return [longRuleText(policyId), REFUND_PROCESS_TEXT];
  return [shortRuleText(policyId), FREE_CANCEL_24H_TEXT, REFUND_PROCESS_TEXT];
}
