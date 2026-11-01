import { createHash } from "crypto";

/**
 * Content checks for pre-booking questions (web form and agent API alike).
 * Pure functions so they are easy to unit test.
 */

export const INQUIRY_LIMITS = {
  nameMax: 80,
  emailMax: 254,
  phoneMax: 40,
  subjectMax: 150,
  bodyMin: 5,
  bodyMax: 2000,
  /** More links than this is rejected */
  maxLinks: 1,
} as const;

const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9-]{2,}\.(?:com|net|org|info|biz|ru|cn|xyz|top|io|co|ly|me|link|click|shop|site|online|store|app|live|win|loan|vip)\b(?:\/[^\s<>"']*)?/gi;

const SHORTENER_RE =
  /\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|cutt\.ly|rb\.gy|shorturl\.at|t\.me|wa\.me)\b/i;

const MARKUP_RE = /<\s*a\s+href|\[url\s*=|\[\/url\]|<\s*script|<\s*iframe/i;

/** Phrases that almost never appear in a real stay question. */
const SPAM_PATTERNS: RegExp[] = [
  /\bseo\b/i,
  /\bbacklinks?\b/i,
  /\bguest ?posts?\b/i,
  /\bcrypto(?:currency)?\b/i,
  /\bbitcoin\b|\bbtc\b|\busdt\b/i,
  /\bforex\b/i,
  /\bcasino\b|\bbetting\b/i,
  /\bviagra\b|\bcialis\b/i,
  /\bpayday loans?\b|\bloan offer\b/i,
  /\bweb ?design services?\b|\bwebsite redesign\b/i,
  /\brank(?:ing)? (?:on|in) google\b|\bfirst page of google\b/i,
  /\bdigital marketing\b|\bleads? generation\b/i,
  /\binvestment opportunit/i,
  /\bclick here\b/i,
  /\bwhatsapp me\b|\btelegram me\b/i,
];

export type InquiryFields = {
  guestName: string;
  guestEmail: string;
  guestPhone?: string | null;
  subject?: string | null;
  body: string;
};

export type FilterResult =
  | { ok: true }
  | { ok: false; code: "invalid" | "links" | "spam"; error: string };

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export function isValidEmail(email: string): boolean {
  return email.length <= INQUIRY_LIMITS.emailMax && EMAIL_RE.test(email);
}

const EMAIL_IN_TEXT_RE = /[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/gi;

/** URLs and bare domains. Email addresses are not counted as links. */
export function countLinks(text: string): number {
  return (text.replace(EMAIL_IN_TEXT_RE, " ").match(URL_RE) ?? []).length;
}

export function spamScore(text: string): number {
  let score = 0;
  for (const re of SPAM_PATTERNS) if (re.test(text)) score += 1;
  // Long runs of one character ("!!!!!!!!", "$$$$$$")
  if (/(.)\1{9,}/.test(text)) score += 1;
  // Mostly capitals (shouting) in a longer message
  const letters = text.replace(/[^a-z]/gi, "");
  if (letters.length >= 40) {
    const caps = letters.replace(/[^A-Z]/g, "").length;
    if (caps / letters.length > 0.7) score += 1;
  }
  return score;
}

export function checkInquiryContent(f: InquiryFields): FilterResult {
  const name = f.guestName.trim();
  const email = f.guestEmail.trim();
  const body = f.body.trim();
  const subject = (f.subject ?? "").trim();
  const phone = (f.guestPhone ?? "").trim();

  if (!name || !email || !body) {
    return {
      ok: false,
      code: "invalid",
      error: "Name, email, and message are required.",
    };
  }
  if (name.length > INQUIRY_LIMITS.nameMax) {
    return { ok: false, code: "invalid", error: "Name is too long." };
  }
  if (!isValidEmail(email)) {
    return {
      ok: false,
      code: "invalid",
      error: "Enter a valid email address.",
    };
  }
  if (phone.length > INQUIRY_LIMITS.phoneMax) {
    return { ok: false, code: "invalid", error: "Phone number is too long." };
  }
  if (subject.length > INQUIRY_LIMITS.subjectMax) {
    return { ok: false, code: "invalid", error: "Subject is too long." };
  }
  if (body.length < INQUIRY_LIMITS.bodyMin) {
    return {
      ok: false,
      code: "invalid",
      error: "Add a little more detail to your message.",
    };
  }
  if (body.length > INQUIRY_LIMITS.bodyMax) {
    return {
      ok: false,
      code: "invalid",
      error: `Messages can be up to ${INQUIRY_LIMITS.bodyMax} characters.`,
    };
  }

  // Links never belong in a name, and only sparingly in a question.
  if (countLinks(name) > 0 || countLinks(subject) > 0) {
    return {
      ok: false,
      code: "links",
      error: "Links aren't allowed in the name or subject.",
    };
  }
  const all = `${subject}\n${body}`;
  if (MARKUP_RE.test(all) || SHORTENER_RE.test(all)) {
    return {
      ok: false,
      code: "links",
      error: "Please remove the link and try again.",
    };
  }
  const links = countLinks(body);
  if (links > INQUIRY_LIMITS.maxLinks) {
    return {
      ok: false,
      code: "links",
      error: "Please remove the links and try again.",
    };
  }

  const score = spamScore(`${name}\n${all}`);
  if (score >= 2 || (score >= 1 && links >= 1)) {
    return {
      ok: false,
      code: "spam",
      error:
        "This message looks like spam, so it wasn't sent. Ask about the stay itself and try again.",
    };
  }
  return { ok: true };
}

/** Lowercase, drop punctuation and extra spaces: "Hi!! Is it free?" → "hi is it free". */
export function normalizeInquiryText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inquiryHash(text: string): string {
  return createHash("sha256")
    .update(normalizeInquiryText(text))
    .digest("hex")
    .slice(0, 40);
}

function wordSet(text: string): Set<string> {
  return new Set(normalizeInquiryText(text).split(" ").filter(Boolean));
}

/** Jaccard similarity of the word sets, 0..1. */
export function inquirySimilarity(a: string, b: string): number {
  const A = wordSet(a);
  const B = wordSet(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter);
}

/** Identical after normalizing, or ≥85% the same words (for 4+ word messages). */
export function isNearDuplicate(a: string, b: string): boolean {
  const na = normalizeInquiryText(a);
  const nb = normalizeInquiryText(b);
  if (na === nb) return true;
  if (na.split(" ").length < 4 || nb.split(" ").length < 4) return false;
  return inquirySimilarity(na, nb) >= 0.85;
}
