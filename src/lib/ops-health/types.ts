export type HealthSeverity = "critical" | "warning" | "info" | "ok";

export type HealthTab = "overview" | "calendar" | "listings" | "system";

export type HealthCheckId =
  | "overlap_blocks"
  | "active_booking_no_block"
  | "booking_block_orphaned"
  | "booking_dates_mismatch"
  | "stale_pending_hold"
  | "channel_overlap"
  | "ical_sync_error"
  | "published_no_images"
  | "published_no_price"
  | "published_no_location"
  | "marketplace_unpublished"
  | "demo_live_mismatch"
  | "host_no_published"
  | "db_ok"
  | "cron_configured"
  | "cron_in_process"
  | "counts";

export type HealthFinding = {
  id: string;
  checkId: HealthCheckId;
  severity: HealthSeverity;
  title: string;
  detail: string;
  hostId?: string;
  hostName?: string;
  propertyId?: string;
  propertyTitle?: string;
  bookingId?: string;
  href?: string;
  meta?: Record<string, string>;
};

export type HealthSummary = {
  critical: number;
  warning: number;
  info: number;
  ok: boolean;
  checkedAt: string;
};

export type SystemStatusRow = {
  label: string;
  value: string;
  tone: "ok" | "warn" | "bad" | "neutral";
};

export type HealthReport = {
  summary: HealthSummary;
  findings: HealthFinding[];
  systemRows?: SystemStatusRow[];
  residualRisks: string[];
};

export const STALE_PENDING_HOURS = 48;
export const ICAL_STALE_HOURS = 36;

export const RESIDUAL_RISKS: string[] = [
  "Concurrent bookings rely on an app-level re-check inside a transaction — there is no database date-range lock yet.",
  "Manual calendar blocks can be added on top of existing bookings without an availability check.",
  "Imported calendar feeds can overlap live bookings (external channel already sold the night).",
  "Deleting a booking calendar block can reopen nights while the booking row stays active.",
  "Pending payment holds do not auto-expire — abandoned requests can block dates indefinitely.",
];
