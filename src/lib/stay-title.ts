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
