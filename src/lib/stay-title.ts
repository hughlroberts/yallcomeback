/** Compact stay name for small switcher tiles. */
export function shortStayTitle(title: string, maxChars = 16): string {
  let t = title.trim();
  t = t.replace(/\s+@\s+.+$/u, "");
  t = t.replace(/^.+?['’]s\s+/u, "");
  t = t.replace(/\s+/g, " ").trim();
  if (!t) t = title.trim();
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const sp = cut.lastIndexOf(" ");
  const base = sp >= 8 ? cut.slice(0, sp) : cut;
  return `${base.replace(/[\s.,;:\-–—]+$/u, "")}…`;
}

/**
 * Labels for the listing switcher tiles: the short form (no host prefix,
 * no "@ place" suffix) without a character cut, so CSS can wrap it to two
 * lines. When two listings would share a label, those fall back to their
 * full titles so similar names stay distinguishable.
 */
export function switcherStayLabels(titles: readonly string[]): string[] {
  const short = titles.map((t) => shortStayTitle(t, Number.POSITIVE_INFINITY));
  const counts = new Map<string, number>();
  for (const s of short) {
    const k = s.toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return short.map((s, i) =>
    (counts.get(s.toLowerCase()) ?? 0) > 1 ? titles[i]!.trim() : s,
  );
}
