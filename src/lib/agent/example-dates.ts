/**
 * Future stay dates for agent docs (/llms.txt, /agents.md).
 * Generated at request time so samples never go stale.
 */

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export type AgentExampleDates = {
  /** ISO date this document was generated (UTC). */
  generated: string;
  /** Sample check-in (~8 weeks out). */
  checkIn: string;
  /** Sample check-out (3 nights after check-in). */
  checkOut: string;
  /** Availability window start (~2 weeks before check-in). */
  from: string;
};

/**
 * Build sample stay dates relative to `now` (default: current time).
 * Always in the future so API examples remain valid.
 */
export function agentExampleDates(now: Date = new Date()): AgentExampleDates {
  const checkIn = addUtcDays(now, 56);
  const checkOut = addUtcDays(checkIn, 3);
  const from = addUtcDays(checkIn, -14);
  return {
    generated: ymd(now),
    checkIn: ymd(checkIn),
    checkOut: ymd(checkOut),
    from: ymd(from),
  };
}
