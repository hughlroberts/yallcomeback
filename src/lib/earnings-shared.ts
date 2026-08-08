/**
 * Client-safe earnings types/constants (no auth/db imports).
 */

export type MonthlyBucket = {
  month: number; // 0–11
  label: string;
  paid: number;
  upcoming: number;
  total: number;
};

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
