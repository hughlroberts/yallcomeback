/**
 * Which season (nightly price override) applies to a night.
 * When ranges overlap, the shortest range wins, so a price set for one
 * night or a few nights beats a broader season. Ties go to the later start.
 */
export function pickSeasonForNight<T>(
  nightMs: number,
  seasons: readonly T[],
  rangeMs: (s: T) => { start: number; end: number },
): T | null {
  let best: T | null = null;
  let bestSpan = Infinity;
  let bestStart = -Infinity;
  for (const s of seasons) {
    const { start, end } = rangeMs(s);
    if (nightMs < start || nightMs > end) continue;
    const span = end - start;
    if (span < bestSpan || (span === bestSpan && start > bestStart)) {
      best = s;
      bestSpan = span;
      bestStart = start;
    }
  }
  return best;
}
