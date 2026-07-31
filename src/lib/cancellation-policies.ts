/**
 * Yall Come Back home cancellation policies.
 * Guest- and host-facing copy uses ASD-STE100 Simplified Technical English.
 * See docs/help-writing-ste.md and AGENTS.md.
 */

/** Short stays: 27 or fewer consecutive nights */
export type ShortStayPolicyId =
  | "FLEXIBLE"
  | "MODERATE"
  | "LIMITED"
  | "FIRM"
  | "STRICT"
  | "SUPER_FIRM_30"
  | "SUPER_FIRM_60";

/** Monthly stays: 28+ consecutive nights */
export type LongStayPolicyId = "FIRM" | "STRICT";

export const SHORT_STAY_NIGHTS_MAX = 27;
export const LONG_STAY_NIGHTS_MIN = 28;

export type PolicyBullet = string;

export type ShortStayPolicy = {
  id: ShortStayPolicyId;
  name: string;
  /** One-line for listing cards / Things to know */
  summary: string;
  bullets: PolicyBullet[];
  /** Stricter policies */
  restricted?: boolean;
};

export type LongStayPolicy = {
  id: LongStayPolicyId;
  name: string;
  summary: string;
  bullets: PolicyBullet[];
};

export const SHORT_STAY_POLICIES: ShortStayPolicy[] = [
  {
    id: "FLEXIBLE",
    name: "Flexible",
    summary:
      "Full refund until 24 hours before check-in. After that, the host keeps one night.",
    bullets: [
      "Guests can cancel until 24 hours before check-in.",
      "If they cancel in that time, they get a full refund of the stay price, including taxes.",
      "You are not paid for that stay.",
      "If they cancel later, they get a refund of pro-rated taxes only.",
      "You are paid for each night they stay, plus one more night.",
    ],
  },
  {
    id: "MODERATE",
    name: "Moderate",
    summary:
      "Full refund until 5 days before check-in. Later cancels keep one night and 50% of unused nights.",
    bullets: [
      "Guests can cancel until 5 days before check-in.",
      "If they cancel in that time, they get a full refund, including taxes.",
      "You are not paid for that stay.",
      "If they cancel later, they get a refund of pro-rated taxes.",
      "You are paid for each night they stay, plus one more night, plus 50% for unused nights.",
    ],
  },
  {
    id: "LIMITED",
    name: "Limited",
    summary:
      "Full refund until 14 days before check-in. 50% refund from 7 to 14 days. No stay refund inside 7 days.",
    bullets: [
      "Guests can cancel until 14 days before check-in for a full refund, including taxes.",
      "You are not paid if they cancel in that time.",
      "If they cancel between 7 and 14 days before check-in (after the 24-hour free window), they get a 50% refund, including full taxes.",
      "You are paid 50% for all nights.",
      "If they cancel less than 7 days before check-in, they get a refund of pro-rated taxes only.",
      "You are paid 100% for all nights.",
    ],
  },
  {
    id: "FIRM",
    name: "Firm",
    summary:
      "Full refund until 30 days before check-in. 50% refund from 7 to 30 days. No stay refund inside 7 days.",
    bullets: [
      "Guests can cancel until 30 days before check-in for a full refund, including taxes.",
      "You are not paid if they cancel in that time.",
      "If they cancel between 7 and 30 days before check-in (after the 24-hour free window), they get a 50% refund, including full taxes.",
      "You are paid 50% for all nights.",
      "If they cancel less than 7 days before check-in, they get a refund of pro-rated taxes only.",
      "You are paid 100% for all nights.",
    ],
  },
  {
    id: "STRICT",
    name: "Strict",
    summary:
      "No full refund after the 24-hour window. 50% if 7 or more days out. No stay refund inside 7 days.",
    restricted: true,
    bullets: [
      "If guests cancel 7 or more days before check-in (after the 24-hour free window), they get a 50% refund, including full taxes.",
      "You are paid 50% for all nights.",
      "If they cancel less than 7 days before check-in, they get a refund of pro-rated taxes only.",
      "You are paid 100% for all nights.",
    ],
  },
  {
    id: "SUPER_FIRM_30",
    name: "Super firm · 30 days",
    summary:
      "50% refund only if cancel at least 30 days out. No stay-price refund inside 30 days.",
    restricted: true,
    bullets: [
      "If guests cancel at least 30 days before check-in (after the 24-hour free window), they get a 50% refund, including full taxes.",
      "You are paid 50% for all nights.",
      "If they cancel less than 30 days before check-in (after the 24-hour free window), they get a refund of pro-rated taxes only.",
      "You are paid 100% for all nights.",
    ],
  },
  {
    id: "SUPER_FIRM_60",
    name: "Super firm · 60 days",
    summary:
      "50% refund only if cancel at least 60 days out. No stay-price refund inside 60 days.",
    restricted: true,
    bullets: [
      "If guests cancel at least 60 days before check-in (after the 24-hour free window), they get a 50% refund, including full taxes.",
      "You are paid 50% for all nights.",
      "If they cancel less than 60 days before check-in (after the 24-hour free window), they get a refund of pro-rated taxes only.",
      "You are paid 100% for all nights.",
    ],
  },
];

export const LONG_STAY_POLICIES: LongStayPolicy[] = [
  {
    id: "FIRM",
    name: "Firm (monthly)",
    summary:
      "Full refund until 30 days before check-in. Later cancels pay used nights plus up to 30 more.",
    bullets: [
      "To get a full refund including taxes, guests must cancel at least 30 days before check-in.",
      "If a guest cancels after that, they get a full refund of taxes.",
      "You are paid 100% for nights already stayed, plus 30 more nights.",
      "If fewer than 30 nights remain when they cancel, they get a pro-rated refund of taxes.",
      "You are paid 100% for all remaining nights.",
    ],
  },
  {
    id: "STRICT",
    name: "Strict (monthly)",
    summary:
      "Full refund only within 48 hours of booking and at least 28 days before check-in.",
    bullets: [
      "To get a full refund including taxes, guests must cancel within 48 hours of booking.",
      "The cancel must also be at least 28 days before check-in.",
      "If a guest cancels after that, they get a full refund of taxes.",
      "You are paid 100% for nights already stayed, plus the next 30 nights of the booking.",
      "If fewer than 30 nights remain when they cancel, they get a pro-rated refund of taxes.",
      "You are paid 100% for all remaining nights.",
    ],
  },
];

export const DEFAULT_SHORT_STAY_POLICY: ShortStayPolicyId = "MODERATE";
export const DEFAULT_LONG_STAY_POLICY: LongStayPolicyId = "FIRM";

/** Permalink for the help-center article (see src/lib/help.ts) */
export { HELP_CANCELLATION_POLICIES_PATH } from "@/lib/help";

export function getShortStayPolicy(
  id: string | null | undefined,
): ShortStayPolicy {
  const found = SHORT_STAY_POLICIES.find((p) => p.id === id);
  return (
    found ||
    SHORT_STAY_POLICIES.find((p) => p.id === DEFAULT_SHORT_STAY_POLICY)!
  );
}

export function getLongStayPolicy(
  id: string | null | undefined,
): LongStayPolicy {
  const found = LONG_STAY_POLICIES.find((p) => p.id === id);
  return (
    found || LONG_STAY_POLICIES.find((p) => p.id === DEFAULT_LONG_STAY_POLICY)!
  );
}

export function isShortStayPolicyId(v: string): v is ShortStayPolicyId {
  return SHORT_STAY_POLICIES.some((p) => p.id === v);
}

export function isLongStayPolicyId(v: string): v is LongStayPolicyId {
  return LONG_STAY_POLICIES.some((p) => p.id === v);
}

/** Which policy applies for a given trip length. */
export function policyForNights(
  nights: number,
  shortId: string | null | undefined,
  longId: string | null | undefined,
): { kind: "short" | "long"; policy: ShortStayPolicy | LongStayPolicy } {
  if (nights >= LONG_STAY_NIGHTS_MIN) {
    return { kind: "long", policy: getLongStayPolicy(longId) };
  }
  return { kind: "short", policy: getShortStayPolicy(shortId) };
}

/**
 * Guest-facing lines for Things to know.
 * Removes host payout sentences (STE and legacy forms).
 */
export function guestFacingBullets(
  policy: ShortStayPolicy | LongStayPolicy,
  max = 3,
): string[] {
  return policy.bullets
    .map((b) =>
      b
        .replace(/, and you are not paid\.?/gi, ".")
        .replace(/You are not paid for that stay\.?/gi, "")
        .replace(/You are not paid if they cancel in that time\.?/gi, "")
        .replace(/You are paid[^.]+\./gi, "")
        .replace(/you won’t be paid\.?/gi, "")
        .replace(/; you’re paid[^.]+\./gi, ".")
        .replace(/you’re paid[^.]+/gi, "")
        .replace(/you won’t be paid/gi, "the host is not paid")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => line.length > 0)
    .slice(0, max);
}
