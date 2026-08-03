import type { LocationTier, QualitySignals } from "./location-quality";

export type InternalListingStats = {
  propertyId: string;
  slug: string;
  title: string;
  city: string | null;
  region: string | null;
  maxGuests: number;
  bedrooms: number;
  baseNightlyRate: number;
  published: boolean;
  listOnMarketplace: boolean;
  bookingCount90d: number;
  confirmedNights90d: number;
  revenue90d: number;
  occupancyEstimate90d: number;
  avgLeadTimeDays: number | null;
  latitude: number | null;
  longitude: number | null;
  quality: QualitySignals;
};

export type PeerComp = {
  /** Marketplace property id, or `comp:<PricingMarketComp.id>` for private proxies */
  propertyId: string;
  title: string;
  maxGuests: number;
  bedrooms: number;
  baseNightlyRate: number;
  city: string | null;
  region: string | null;
  distanceGuests: number;
  /** Lower = better match */
  matchScore: number;
  matchReasons: string[];
  quality: QualitySignals;
  distanceMiles: number | null;
  fair: boolean;
  /** True when peer is a private PricingMarketComp (never public) */
  privateProxy?: boolean;
};

export type ExternalSignalNote = {
  source: "llm" | "heuristic" | "none";
  summary: string;
  citations?: string[];
};

/** Aggregated HITL feedback from prior decisions on this host. */
export type HitlMemory = {
  totalDecisions: number;
  rejectedCount: number;
  approvedCount: number;
  appliedCount: number;
  /** Tag counts e.g. wrong_comps, location_mismatch */
  tagCounts: Record<string, number>;
  recentNotes: string[];
  /** If hosts often flag location mismatches, tighten tier matching */
  preferStrictLocation: boolean;
  preferPoolMatch: boolean;
};

export type CollectorBundle = {
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  hostId: string;
  hostName: string;
  listings: InternalListingStats[];
  peerCompsByPropertyId: Record<string, PeerComp[]>;
  external: ExternalSignalNote;
  hitl: HitlMemory;
  notes: string[];
};

export type AnalystSuggestion = {
  propertyId: string;
  currentNightlyRate: number;
  suggestedNightlyRate: number;
  changePercent: number;
  basis: "CAPACITY" | "COMPETITIVE" | "SEASONALITY" | "OCCUPANCY" | "MIXED";
  confidence: number;
  rationale: string;
  experimentNote: string;
  projectedImpact: string;
  riskNotes: string;
  evidence: Record<string, unknown>;
  doNothing?: boolean;
  /** Ask human to clarify when comps are ambiguous */
  needsHitlClarification?: boolean;
  hitlPrompt?: string;
};

export type FeedbackTag =
  | "accepted_as_is"
  | "wrong_comps"
  | "location_mismatch"
  | "amenity_mismatch"
  | "too_aggressive"
  | "too_conservative"
  | "capacity_ok_location_wrong"
  | "unclear_want_hold"
  | "other";

export { type LocationTier, type QualitySignals };
