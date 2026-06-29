/**
 * Destination Intelligence — core types and DB row shape.
 * Matches public.advertiser_destinations (see supabase/migrations/20260629120000_advertiser_destinations.sql).
 */

export type DestinationEnrichmentStatus = "pending" | "enriching" | "ready" | "error";

/** Persisted landing-page intelligence row. */
export type AdvertiserDestinationRow = {
  id: number;
  advertiser: string;
  /** Hostname of the landing page (e.g. commbank.com.au). */
  domain: string;
  url: string;
  url_hash: string;
  page_title: string | null;
  product: string | null;
  offer: string | null;
  cta: string | null;
  persona: string | null;
  theme: string | null;
  funnel_stage: string | null;
  first_seen: string;
  last_seen: string;
  ad_count: number;
  enrichment_status: DestinationEnrichmentStatus;
  enriched_at: string | null;
  raw_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AdvertiserDestinationInsert = Omit<
  AdvertiserDestinationRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: number;
  created_at?: string;
  updated_at?: string;
};

/** Normalised extraction from a single ad / placement with a destination URL. */
export type ExtractedDestination = {
  advertiser: string;
  domain: string;
  url: string;
  url_hash: string;
  page_title: string | null;
  product: string | null;
  offer: string | null;
  cta: string | null;
  persona: string | null;
  theme: string | null;
  funnel_stage: string | null;
  first_seen: string | null;
  last_seen: string | null;
  source: "placement" | "warroom" | "engine";
};

/** Input shapes the enrichment layer accepts (no new APIs). */
export type AdWithDestination = {
  advertiser?: string | null;
  domain?: string | null;
  landing_url?: string | null;
  destination_url?: string | null;
  page_title?: string | null;
  page_description?: string | null;
  primary_cta?: string | null;
  detected_cta?: string | null;
  extracted_offer?: string | null;
  offer_signal?: string | null;
  offer_theme?: string | null;
  offer_type?: string | null;
  buyer_stage?: string | null;
  product_type?: string | null;
  product_category?: string | null;
  emotional_driver?: string | null;
  advertiser_name?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  ai_tags?: Record<string, unknown> | string | null;
};

export type DestinationMixItem = {
  label: string;
  count: number;
  pct: number;
};

export type AdvertiserDestinationSummary = {
  productsPromoted: DestinationMixItem[];
  primaryOffers: DestinationMixItem[];
  primaryAudiences: DestinationMixItem[];
  funnelMix: DestinationMixItem[];
  topDestinations: {
    url: string;
    domain: string;
    page_title: string | null;
    ad_count: number;
    pct: number;
  }[];
  available: boolean;
  incomplete: string[];
};

export type MarketDestinationTrends = {
  productTrends: { label: string; advertisers: number; ad_count: number }[];
  offerTrends: { label: string; advertisers: number; ad_count: number }[];
  audienceTrends: { label: string; advertisers: number; ad_count: number }[];
  available: boolean;
};

export type DestinationSignalNodeKind =
  | "advertiser"
  | "product"
  | "offer"
  | "persona"
  | "cta"
  | "theme";

export type DestinationSignalNode = {
  id: string;
  kind: DestinationSignalNodeKind;
  label: string;
  hoverText: string;
  weight: number;
};

export type DestinationSignalGraph = {
  nodes: DestinationSignalNode[];
  edges: { from: string; to: string }[];
  available: boolean;
  incomplete: string[];
};

export const DESTINATION_SIGNAL_COLORS: Record<DestinationSignalNodeKind, string> = {
  advertiser: "#C9963A",
  product: "#3B82F6",
  offer: "#16A34A",
  persona: "#6366F1",
  cta: "#D97706",
  theme: "#8B5CF6",
};
