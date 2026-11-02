/**
 * Guest-facing copy of listing text (About this place, host About, meta, API).
 * Listing import appends a host-only source note to the description:
 *
 *   —
 *   Imported from Airbnb
 *   https://www.airbnb.com/rooms/600541790815158094
 *   ID 600541790815158094
 *
 * That note and any airbnb.com / vrbo.com links are dropped when the text is
 * shown. The stored text is left as is (the host still sees it in admin).
 */

const IMPORT_LINE = /^\s*imported from (?:airbnb|vrbo)\b.*$/i;
const SEPARATOR = /^\s*[—–-]{1,3}\s*$/;
const SOURCE_URL =
  /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:airbnb|vrbo)\.[a-z.]{2,10}(?:\/[^\s)<>"']*)?/gi;

export function publicListingText(
  text: string | null | undefined,
): string | null {
  if (text == null) return null;
  let lines = text.replace(/\r\n?/g, "\n").split("\n");

  // Import note block: cut from its "—" separator (or the "Imported from"
  // line) to the end; everything after it is importer notes.
  const at = lines.findIndex((l) => IMPORT_LINE.test(l));
  if (at >= 0) {
    let cut = at;
    let i = at - 1;
    while (i >= 0 && !lines[i].trim()) i--;
    if (i >= 0 && SEPARATOR.test(lines[i])) cut = i;
    lines = lines.slice(0, cut);
  }

  const cleaned = lines
    .flatMap((line) => {
      if (!line.match(SOURCE_URL)) return [line];
      const rest = line
        .replace(SOURCE_URL, "")
        .replace(/\s+([.,;:!?)])/g, "$1");
      // Drop a line that was only a link, or a "Label:" plus a link.
      if (!/\p{L}/u.test(rest) || /^\s*[\p{L} ]{1,24}:\s*$/u.test(rest)) {
        return [];
      }
      return [rest.replace(/[ \t]+$/, "").replace(/ {2,}/g, " ")];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || null;
}
