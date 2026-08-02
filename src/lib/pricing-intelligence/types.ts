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
  occupancyEstimate90d: number; // 0–1 rough
  avgLeadTimeDays: number | null;
};

export type PeerComp = {
  propertyId: string;
  title: string;
  maxGuests: number;
  bedrooms: number;
  baseNightlyRate: number;
  city: string | null;
  region: string | null;
  distanceGuests: number; // |peer.maxGuests - target.maxGuests|
};

export type ExternalSignalNote = {
  source: "llm" | "heuristic" | "none";
  summary: string;
  citations?: string[];
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
};
