/** Row shape for public.advertiser_destinations. */

export type DestinationEnrichmentStatus = "pending" | "enriching" | "ready" | "error";

export type AdvertiserDestinationRow = {
  id: number;
  advertiser: string;
  domain: string;
  url: string;
  url_hash: string;
  page_title: string | null;
  meta_description: string | null;
  h1: string | null;
  h2s: string[] | null;
  visible_offers: string[] | null;
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

export type AdvertiserDestinationUpsertInput = {
  advertiser: string;
  domain: string;
  url: string;
  url_hash: string;
  page_title?: string | null;
  meta_description?: string | null;
  h1?: string | null;
  h2s?: string[] | null;
  visible_offers?: string[] | null;
  product?: string | null;
  offer?: string | null;
  cta?: string | null;
  persona?: string | null;
  theme?: string | null;
  funnel_stage?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  enrichment_status?: DestinationEnrichmentStatus;
  enriched_at?: string | null;
  raw_snapshot?: Record<string, unknown> | null;
};

export type AdvertiserDestinationUpsertResult = {
  id: number;
  action: "inserted" | "updated";
  row: AdvertiserDestinationRow;
};
