/**
 * Pure: keep only what the person just wrote in an email reply. Drops the
 * quoted original ("On … wrote:", "> " lines, Outlook headers), common
 * signatures ("-- ", "Sent from my iPhone"), and our own email footer.
 */

const CUT_LINE_PATTERNS: RegExp[] = [
  // Gmail / Apple Mail: "On Sun, Nov 1, 2026 at 9:00 AM Hugh <x@y> wrote:"
  /^\s*On\b.{0,300}\bwrote:\s*$/i,
  // Outlook / older clients
  /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i,
  /^\s*_{10,}\s*$/,
  /^\s*From:\s.+$/i,
  /^\s*Sent from my (iPhone|iPad|Android|Galaxy|mobile device)\b/i,
  /^\s*Get Outlook for (iOS|Android)\b/i,
  // Signature delimiter
  /^-- ?$/,
  // Our own footer (see messaging.ts buildEmailBodies)
  /^—\s*$/,
  /^Reply in your inbox: https?:\/\//i,
  /^You can reply to this email\b/i,
];

export function htmlToText(html: string): string {
  return html
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<div class="gmail_quote[\s\S]*$/i, "")
    .replace(/<(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // "On … at …\n… wrote:" split over two lines by some clients
    if (
      /^\s*On\b/i.test(line) &&
      i + 1 < lines.length &&
      /\bwrote:\s*$/i.test(lines[i + 1]) &&
      (line + lines[i + 1]).length < 300
    ) {
      break;
    }
    if (CUT_LINE_PATTERNS.some((re) => re.test(line))) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
